class KakaoAuto < Formula
  desc "macOS KakaoTalk automation CLI and GUI"
  homepage "https://github.com/youngwoohome/kakaotalk-cli"
  url "https://github.com/youngwoohome/kakaotalk-cli.git",
      using: :git,
      tag: "v0.1.0",
      revision: "2c5393a712f0bd0be15429de8e0a0459d6036cbd"
  version "0.1.0"

  depends_on "node"
  depends_on :macos

  def install
    ENV["npm_config_cache"] = buildpath/"npm_cache"
    ENV["npm_config_include"] = "optional"

    system "npm", "install", "--include=optional", *std_npm_args
    bin.install_symlink libexec/"bin/kakao-auto"
  end

  def caveats
    <<~EOS
      KakaoTalk.app must be installed at /Applications/KakaoTalk.app.
      Accessibility permission is required for your terminal app.
    EOS
  end

  test do
    assert_match "Usage: kakao-auto", shell_output("#{bin}/kakao-auto --help")
  end
end
