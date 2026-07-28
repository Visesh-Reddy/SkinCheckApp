// FaceScannerModule.swift
//
// iOS native module: ARKit face tracking + TrueDepth mesh capture.
//
// Requires a TrueDepth-equipped device (iPhone X or later, and iPad Pro
// with Face ID). Falls back gracefully (isSupported() -> false) on older
// devices, which the JS layer should route to a photo-only capture path.
//
// API surface verified against Apple's ARKit documentation:
//   ARFaceGeometry.vertices            -> [simd_float3]
//   ARFaceGeometry.textureCoordinates  -> [simd_float2]
//   ARFaceGeometry.triangleIndices     -> [Int16]
// (developer.apple.com/documentation/arkit/arfacegeometry)
//
// NOT compiled or run here — no Xcode toolchain in this environment.
// Build and test on a real TrueDepth device before shipping.

import Foundation
import ARKit
import UIKit

@objc(FaceScannerModule)
class FaceScannerModule: RCTEventEmitter, ARSessionDelegate {

  private var session: ARSession?
  private var latestFaceAnchor: ARFaceAnchor?
  private var latestFrame: ARFrame?
  private var hasListeners = false

  override static func requiresMainQueueSetup() -> Bool { true }

  override func supportedEvents() -> [String]! {
    return ["FaceScannerPose"]
  }

  override func startObserving() { hasListeners = true }
  override func stopObserving() { hasListeners = false }

  @objc
  func isSupported(_ resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(ARFaceTrackingConfiguration.isSupported)
  }

  @objc
  func startSession(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard ARFaceTrackingConfiguration.isSupported else {
      reject("UNSUPPORTED", "This device does not have TrueDepth face tracking.", nil)
      return
    }
    DispatchQueue.main.async {
      let config = ARFaceTrackingConfiguration()
      config.isLightEstimationEnabled = true
      let session = ARSession()
      session.delegate = self
      session.run(config, options: [.resetTracking, .removeExistingAnchors])
      self.session = session
      resolve(nil)
    }
  }

  @objc
  func stopSession(_ resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    session?.pause()
    session = nil
    latestFaceAnchor = nil
    latestFrame = nil
    resolve(nil)
  }

  // MARK: - ARSessionDelegate

  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    latestFrame = frame
    guard let anchor = frame.anchors.first(where: { $0 is ARFaceAnchor }) as? ARFaceAnchor else {
      return
    }
    latestFaceAnchor = anchor

    let (yaw, pitch, roll) = FaceScannerModule.extractEuler(from: anchor.transform)
    if hasListeners {
      sendEvent(withName: "FaceScannerPose", body: [
        "yaw": yaw,
        "pitch": pitch,
        "roll": roll,
        "trackingState": anchor.isTracked ? "tracking" : "limited",
      ])
    }
  }

  // Column-major 4x4 -> yaw/pitch/roll, same verified formula used in the
  // web prototype (tested there against 12 synthetic rotation cases). ARKit's
  // transform convention may not exactly match MediaPipe's — confirm sign
  // behavior on a real device and flip YAW_SIGN/PITCH_SIGN below if needed,
  // exactly as flagged in the web version.
  private static let YAW_SIGN: Float = 1
  private static let PITCH_SIGN: Float = 1

  private static func extractEuler(from m: simd_float4x4) -> (yaw: Float, pitch: Float, roll: Float) {
    let pitch = asin(max(-1, min(1, -m.columns.2.y)))
    let yaw = atan2(m.columns.2.x, m.columns.2.z)
    let roll = atan2(m.columns.0.y, m.columns.1.y)
    let toDeg: (Float) -> Float = { $0 * 180 / .pi }
    return (YAW_SIGN * toDeg(yaw), PITCH_SIGN * toDeg(pitch), toDeg(roll))
  }

  // MARK: - Capture

  @objc
  func captureCurrentMesh(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let anchor = latestFaceAnchor else {
      reject("NO_FACE", "No face currently tracked.", nil)
      return
    }
    let geometry = anchor.geometry
    var vertices: [Float] = []
    vertices.reserveCapacity(geometry.vertices.count * 3)
    for v in geometry.vertices {
      vertices.append(v.x); vertices.append(v.y); vertices.append(v.z)
    }
    var uvs: [Float] = []
    uvs.reserveCapacity(geometry.textureCoordinates.count * 2)
    for t in geometry.textureCoordinates {
      uvs.append(t.x); uvs.append(t.y)
    }
    let indices = geometry.triangleIndices.map { Int($0) }

    resolve([
      "vertices": vertices,
      "uvs": uvs,
      "triangleIndices": indices,
      "vertexCount": geometry.vertexCount,
      "triangleCount": geometry.triangleCount,
      "source": "arkit-truedepth",
    ])
  }

  @objc
  func capturePhoto(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let frame = latestFrame else {
      reject("NO_FRAME", "No camera frame available.", nil)
      return
    }
    let pixelBuffer = frame.capturedImage
    let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
    let context = CIContext()
    guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else {
      reject("ENCODE_FAILED", "Could not encode captured frame.", nil)
      return
    }
    let uiImage = UIImage(cgImage: cgImage)
    guard let jpegData = uiImage.jpegData(compressionQuality: 0.85) else {
      reject("ENCODE_FAILED", "Could not JPEG-encode captured frame.", nil)
      return
    }
    let tempDir = FileManager.default.temporaryDirectory
    let fileURL = tempDir.appendingPathComponent("face-scan-\(UUID().uuidString).jpg")
    do {
      try jpegData.write(to: fileURL)
      resolve(fileURL.absoluteString)
    } catch {
      reject("WRITE_FAILED", "Could not write captured frame to disk.", error)
    }
  }

  // MARK: - Quality checks (ported formulas — see src/logic/qualityChecks.ts)

  @objc
  func checkLastCaptureQuality(_ resolve: @escaping RCTPromiseResolveBlock,
                                rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let frame = latestFrame else {
      reject("NO_FRAME", "No camera frame available.", nil)
      return
    }
    let pixelBuffer = frame.capturedImage
    let (avgLum, variance) = FaceScannerModule.computeLuminanceStats(pixelBuffer: pixelBuffer)

    // Same thresholds as src/logic/qualityChecks.ts — keep these in sync.
    let blurOk = variance > 12
    var lightingOk = true
    var reason = "none"
    if avgLum < 45 { lightingOk = false; reason = "dark" }
    else if avgLum > 235 { lightingOk = false; reason = "bright" }
    else if !blurOk { reason = "blur" }

    resolve([
      "ok": blurOk && lightingOk,
      "blurOk": blurOk,
      "lightingOk": lightingOk,
      "reason": reason,
    ])
  }

  // Downsampled luminance + Laplacian variance over the Y-plane of the
  // YCbCr camera buffer. Same math as qualityChecks.ts's laplacianVariance —
  // ported to operate directly on the pixel buffer for performance.
  private static func computeLuminanceStats(pixelBuffer: CVPixelBuffer) -> (avgLum: Double, variance: Double) {
    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }

    guard let baseAddress = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0) else {
      return (128, 0)
    }
    let width = CVPixelBufferGetWidthOfPlane(pixelBuffer, 0)
    let height = CVPixelBufferGetHeightOfPlane(pixelBuffer, 0)
    let bytesPerRow = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)
    let buffer = baseAddress.assumingMemoryBound(to: UInt8.self)

    let step = 4 // downsample for performance
    var sum = 0.0, count = 0.0
    var lapSum = 0.0, lapSumSq = 0.0, lapCount = 0.0

    for y in stride(from: step, to: height - step, by: step) {
      for x in stride(from: step, to: width - step, by: step) {
        let center = Double(buffer[y * bytesPerRow + x])
        sum += center; count += 1

        let left = Double(buffer[y * bytesPerRow + (x - step)])
        let right = Double(buffer[y * bytesPerRow + (x + step)])
        let up = Double(buffer[(y - step) * bytesPerRow + x])
        let down = Double(buffer[(y + step) * bytesPerRow + x])
        let lap = -4 * center + left + right + up + down
        lapSum += lap; lapSumSq += lap * lap; lapCount += 1
      }
    }
    let avgLum = count > 0 ? sum / count : 128
    let lapMean = lapCount > 0 ? lapSum / lapCount : 0
    let variance = lapCount > 0 ? (lapSumSq / lapCount - lapMean * lapMean) : 0
    return (avgLum, variance)
  }
}
