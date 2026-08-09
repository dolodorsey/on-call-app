import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

guard CommandLine.arguments.count == 2 else {
    fail("Usage: swift flatten-ios-icons.swift <AppIcon.appiconset>")
}

let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let manager = FileManager.default
let files: [URL]
do {
    files = try manager.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        .filter { $0.pathExtension.lowercased() == "png" }
        .sorted { $0.lastPathComponent < $1.lastPathComponent }
} catch {
    fail("Could not enumerate app icons: \(error)")
}

guard !files.isEmpty else { fail("No PNG app icons found in \(directory.path)") }

for file in files {
    guard let source = CGImageSourceCreateWithURL(file as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        fail("Could not decode \(file.lastPathComponent)")
    }

    let width = image.width
    let height = image.height
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bytesPerRow = width * 4

    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
    ) else {
        fail("Could not create opaque bitmap for \(file.lastPathComponent)")
    }

    context.setFillColor(CGColor(red: 0.02, green: 0.03, blue: 0.05, alpha: 1.0))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.interpolationQuality = .high
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

    guard let flattened = context.makeImage() else {
        fail("Could not render opaque image for \(file.lastPathComponent)")
    }

    let temporary = file.deletingPathExtension().appendingPathExtension("opaque.png")
    guard let destination = CGImageDestinationCreateWithURL(
        temporary as CFURL,
        UTType.png.identifier as CFString,
        1,
        nil
    ) else {
        fail("Could not create PNG destination for \(file.lastPathComponent)")
    }
    CGImageDestinationAddImage(destination, flattened, nil)
    guard CGImageDestinationFinalize(destination) else {
        fail("Could not write opaque PNG for \(file.lastPathComponent)")
    }

    do {
        if manager.fileExists(atPath: file.path) { try manager.removeItem(at: file) }
        try manager.moveItem(at: temporary, to: file)
    } catch {
        fail("Could not replace \(file.lastPathComponent): \(error)")
    }

    print("Flattened \(file.lastPathComponent) (\(width)x\(height))")
}

print("Flattened \(files.count) App Store icon PNG(s) without alpha.")
