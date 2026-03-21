class KakaoAuto < Formula
  desc "macOS KakaoTalk automation CLI"
  homepage "https://example.com/kakao-auto"
  url "REPLACE_ME"
  sha256 "REPLACE_ME"
  version "0.1.0"

  depends_on "node"
  depends_on :macos

  def install
    ENV["npm_config_cache"] = buildpath/"npm_cache"
    ENV["npm_config_omit"] = "optional"

    system "npm", "install", *std_npm_args
    bin.install_symlink libexec/"bin/kakao-auto"
  end

  def caveats
    <<~EOS
      KakaoTalk.app must be installed at /Applications/KakaoTalk.app.
      Accessibility permission is required for your terminal app.

      This Homebrew formula installs the CLI runtime only.
      If you need the Electron GUI, use the source checkout with:
        npm install --include=optional
        ./bin/kakao-auto gui
    EOS
  end

  test do
    assert_match "Usage: kakao-auto", shell_output("#{bin}/kakao-auto --help")
  end
end
