import ExpoModulesCore
import UIKit

// iOS ekran kaydı / ekran yansıtma durumu: isCaptured() ve değişince "onChange" { captured } olayı
// (büyütülmüş profil fotoğrafı görünümünde fotoğrafı gizlemek için)
public final class ScreenRecordingModule: Module {
  private var observing = false

  public func definition() -> ModuleDefinition {
    Name("ScreenRecording")
    Events("onChange")

    Function("isCaptured") { () -> Bool in
      return UIScreen.main.isCaptured
    }

    OnStartObserving {
      guard !self.observing else { return }
      self.observing = true
      NotificationCenter.default.addObserver(self, selector: #selector(self.capturedChanged), name: UIScreen.capturedDidChangeNotification, object: nil)
    }

    OnStopObserving {
      guard self.observing else { return }
      self.observing = false
      NotificationCenter.default.removeObserver(self, name: UIScreen.capturedDidChangeNotification, object: nil)
    }
  }

  @objc
  private func capturedChanged() {
    sendEvent("onChange", ["captured": UIScreen.main.isCaptured])
  }
}
