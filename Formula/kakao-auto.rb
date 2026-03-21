class KakaoAuto < Formula
  desc "macOS KakaoTalk automation CLI and GUI"
  homepage "https://github.com/youngwoohome/kakaotalk-cli"
  url "https://github.com/youngwoohome/kakaotalk-cli.git",
      using: :git,
      tag: "v0.1.2",
      revision: "949676ed2126d2b5cda2dae76c41e0e266060d84"
  version "0.1.2"

  depends_on "node"
  depends_on :macos

  def install
    ENV["npm_config_cache"] = buildpath/"npm_cache"
    ENV["npm_config_include"] = "optional"

    system "npm", "install", "--include=optional", *std_npm_args

    electron_install = libexec/"lib/node_modules/kakaotalk-auto-reconstructed/node_modules/electron/install.js"
    if electron_install.exist?
      system Formula["node"].opt_bin/"node", electron_install
    end

    bin.install_symlink libexec/"lib/node_modules/kakaotalk-auto-reconstructed/bin/kakao-auto" => "kakao-auto"
    bin.install_symlink libexec/"lib/node_modules/kakaotalk-auto-reconstructed/bin/kakao-auto" => "kakao"
  end

  def caveats
    <<~EOS
      KakaoTalk.app must be installed at /Applications/KakaoTalk.app.
      Accessibility permission is required for your terminal app.
    EOS
  end

  test do
    assert_match "Usage: kakao", shell_output("#{bin}/kakao --help")
  end
end
