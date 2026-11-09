// 用 macOS 自带的 General MIDI 音色库（gs_instruments.dls）离线渲染单个音，做成采样。
// 用法：gmrender <program 0-127> <输出目录> <持续秒数> <音色库路径 .dls/.sf2> <bankMSB：121 旋律 / 120 打击乐> <midi 音高...>
// 每个音输出 <输出目录>/<音高>.f32（44.1kHz 单声道 float32）
import AVFoundation

let a = CommandLine.arguments
let program = UInt8(a[1])!, outDir = a[2], hold = Double(a[3])!
let dls = URL(fileURLWithPath: a[4]), msb = UInt8(a[5])!
let notes = a[6...].compactMap { UInt8($0) }
let fmt = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2)!

for note in notes {
  let engine = AVAudioEngine(), sampler = AVAudioUnitSampler()
  engine.attach(sampler); engine.connect(sampler, to: engine.mainMixerNode, format: nil)
  try! engine.enableManualRenderingMode(.offline, format: fmt, maximumFrameCount: 4096)
  try! sampler.loadSoundBankInstrument(at: dls, program: program, bankMSB: msb, bankLSB: 0)
  try! engine.start()
  let total = Int((hold + 1.0) * 44100)
  var mono = [Float](repeating: 0, count: total)
  let buf = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: 4096)!
  sampler.startNote(note, withVelocity: 100, onChannel: 0)
  var done = 0, stopped = false
  while done < total {
    let n = min(4096, total - done)
    if !stopped && Double(done) >= hold * 44100 { sampler.stopNote(note, onChannel: 0); stopped = true }
    _ = try! engine.renderOffline(AVAudioFrameCount(n), to: buf)
    let l = buf.floatChannelData![0], r = buf.floatChannelData![1]
    for i in 0..<n { mono[done + i] = 0.5 * (l[i] + r[i]) }
    done += n
  }
  engine.stop()
  let data = mono.withUnsafeBufferPointer { Data(buffer: $0) }
  FileManager.default.createFile(atPath: "\(outDir)/\(note).f32", contents: data)
}
