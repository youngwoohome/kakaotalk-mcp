import Foundation
import AppKit
import ApplicationServices

struct Room: Codable {
    let id: String
    let rowIndex: Int
    let roomName: String
    let lastActivity: String
    let rawParts: [String]
}

enum NativeError: Error, CustomStringConvertible {
    case message(String)

    var description: String {
        switch self {
        case .message(let text):
            return text
        }
    }
}

@discardableResult
func shell(_ launchPath: String, _ args: [String]) throws -> String {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: launchPath)
    process.arguments = args

    let stdoutPipe = Pipe()
    let stderrPipe = Pipe()
    process.standardOutput = stdoutPipe
    process.standardError = stderrPipe

    try process.run()
    process.waitUntilExit()

    let stdout = String(data: stdoutPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
    let stderr = String(data: stderrPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
    if process.terminationStatus != 0 {
        throw NativeError.message(stderr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? stdout : stderr)
    }
    return stdout.trimmingCharacters(in: .whitespacesAndNewlines)
}

func ensureTrusted() throws {
    if !AXIsProcessTrusted() {
        throw NativeError.message("손쉬운 사용 권한이 필요합니다.")
    }
}

func kakaoApp() throws -> NSRunningApplication {
    if let app = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == "KakaoTalk" }) {
        return app
    }

    try shell("/usr/bin/open", ["-a", "/Applications/KakaoTalk.app"])
    usleep(700_000)

    if let app = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == "KakaoTalk" }) {
        return app
    }

    throw NativeError.message("KakaoTalk 앱을 찾지 못했습니다.")
}

func axAppElement(_ app: NSRunningApplication) -> AXUIElement {
    AXUIElementCreateApplication(app.processIdentifier)
}

func cfArray<T>(_ value: AnyObject?) -> [T] {
    guard let array = value as? [T] else { return [] }
    return array
}

func copyAttribute(_ element: AXUIElement, _ attribute: CFString) -> AnyObject? {
    var value: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(element, attribute, &value)
    guard result == .success else { return nil }
    return value
}

func setAttribute(_ element: AXUIElement, _ attribute: CFString, _ value: CFTypeRef) -> Bool {
    AXUIElementSetAttributeValue(element, attribute, value) == .success
}

func pointValue(_ element: AXUIElement, _ attribute: CFString) -> CGPoint? {
    guard let value = copyAttribute(element, attribute) else { return nil }
    guard CFGetTypeID(value) == AXValueGetTypeID() else { return nil }
    let axValue = value as! AXValue
    guard AXValueGetType(axValue) == .cgPoint else { return nil }
    var point = CGPoint.zero
    guard AXValueGetValue(axValue, .cgPoint, &point) else { return nil }
    return point
}

func sizeValue(_ element: AXUIElement, _ attribute: CFString) -> CGSize? {
    guard let value = copyAttribute(element, attribute) else { return nil }
    guard CFGetTypeID(value) == AXValueGetTypeID() else { return nil }
    let axValue = value as! AXValue
    guard AXValueGetType(axValue) == .cgSize else { return nil }
    var size = CGSize.zero
    guard AXValueGetValue(axValue, .cgSize, &size) else { return nil }
    return size
}

func frameText(_ element: AXUIElement) -> String? {
    guard let origin = pointValue(element, kAXPositionAttribute as CFString),
          let size = sizeValue(element, kAXSizeAttribute as CFString) else {
        return nil
    }
    return String(format: "frame=%.0f,%.0f,%.0f,%.0f", origin.x, origin.y, size.width, size.height)
}

func titleOf(_ element: AXUIElement) -> String {
    if let title = copyAttribute(element, kAXTitleAttribute as CFString) as? String {
        return title
    }
    return ""
}

func roleOf(_ element: AXUIElement) -> String {
    if let role = copyAttribute(element, kAXRoleAttribute as CFString) as? String {
        return role
    }
    return ""
}

func cfArray(_ value: AnyObject?, as _: AXUIElement.Type) -> [AXUIElement] {
    guard let array = value as? [AXUIElement] else { return [] }
    return array
}

func mainWindow(_ appElement: AXUIElement) throws -> AXUIElement {
    let windows = cfArray(copyAttribute(appElement, kAXWindowsAttribute as CFString), as: AXUIElement.self)
    if let named = windows.first(where: { titleOf($0) == "KakaoTalk" }) {
        return named
    }
    if let first = windows.first {
        return first
    }
    throw NativeError.message("KakaoTalk 메인 창을 찾지 못했습니다.")
}

func allWindows(_ appElement: AXUIElement) -> [AXUIElement] {
    cfArray(copyAttribute(appElement, kAXWindowsAttribute as CFString), as: AXUIElement.self)
}

func namedWindow(_ appElement: AXUIElement, title: String) -> AXUIElement? {
    let normalizedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalizedTitle.isEmpty else { return nil }

    let windows = allWindows(appElement)
    if let exact = windows.first(where: { titleOf($0) == normalizedTitle }) {
        return exact
    }

    if let partial = windows.first(where: {
        let windowTitle = titleOf($0)
        return windowTitle.contains(normalizedTitle) || normalizedTitle.contains(windowTitle)
    }) {
        return partial
    }

    return nil
}

func keyEvent(keyCode: CGKeyCode, flags: CGEventFlags = []) throws {
    guard let source = CGEventSource(stateID: .hidSystemState) else {
        throw NativeError.message("키 이벤트 소스를 만들지 못했습니다.")
    }

    let down = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: true)
    down?.flags = flags
    down?.post(tap: .cghidEventTap)

    let up = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: false)
    up?.flags = flags
    up?.post(tap: .cghidEventTap)
}

func activateChatTab(_ app: NSRunningApplication) throws {
    app.activate(options: [.activateIgnoringOtherApps])
    usleep(250_000)
    try keyEvent(keyCode: 19, flags: .maskCommand) // cmd+2
    usleep(250_000)
}

func findListContainer(window: AXUIElement) -> AXUIElement? {
    let windowChildren = cfArray(copyAttribute(window, kAXChildrenAttribute as CFString), as: AXUIElement.self)
    let scrollAreas = windowChildren.filter { roleOf($0) == kAXScrollAreaRole as String }
    var bestMatch: AXUIElement?
    var bestCount = 0

    for scrollArea in scrollAreas {
        let children = cfArray(copyAttribute(scrollArea, kAXChildrenAttribute as CFString), as: AXUIElement.self)
        for child in children {
            let role = roleOf(child)
            guard role == kAXTableRole as String || role == kAXOutlineRole as String else {
                continue
            }

            let rowCount = cfArray(copyAttribute(child, kAXRowsAttribute as CFString), as: AXUIElement.self).count
            if rowCount > bestCount {
                bestCount = rowCount
                bestMatch = child
            }
        }
    }

    return bestMatch
}

func messageTable(window: AXUIElement) -> AXUIElement? {
    let windowChildren = cfArray(copyAttribute(window, kAXChildrenAttribute as CFString), as: AXUIElement.self)
    let scrollAreas = windowChildren.filter { roleOf($0) == kAXScrollAreaRole as String }

    for scrollArea in scrollAreas {
        let children = cfArray(copyAttribute(scrollArea, kAXChildrenAttribute as CFString), as: AXUIElement.self)
        if let table = children.first(where: { roleOf($0) == kAXTableRole as String }) {
            return table
        }
    }

    return nil
}

func messageScrollArea(window: AXUIElement) -> AXUIElement? {
    let windowChildren = cfArray(copyAttribute(window, kAXChildrenAttribute as CFString), as: AXUIElement.self)
    let scrollAreas = windowChildren.filter { roleOf($0) == kAXScrollAreaRole as String }

    for scrollArea in scrollAreas {
        let children = cfArray(copyAttribute(scrollArea, kAXChildrenAttribute as CFString), as: AXUIElement.self)
        if children.contains(where: { roleOf($0) == kAXTableRole as String }) {
            return scrollArea
        }
    }

    return nil
}

func firstScrollBar(in scrollArea: AXUIElement) -> AXUIElement? {
    let children = cfArray(copyAttribute(scrollArea, kAXChildrenAttribute as CFString), as: AXUIElement.self)
    return children.first(where: { roleOf($0) == kAXScrollBarRole as String })
}

func dumpElement(_ element: AXUIElement, depth: Int = 0, maxDepth: Int = 4, lines: inout [String]) {
    if depth > maxDepth {
        return
    }

    let indent = String(repeating: "  ", count: depth)
    let role = roleOf(element)
    let title = titleOf(element)
    let description = (copyAttribute(element, kAXDescriptionAttribute as CFString) as? String) ?? ""
    let value = copyAttribute(element, kAXValueAttribute as CFString)
    var valueText = ""
    if let text = value as? String {
        valueText = text.replacingOccurrences(of: "\n", with: "\\n")
    } else if let number = value as? NSNumber {
        valueText = number.stringValue
    }

    var valueSettable = DarwinBoolean(false)
    let settableStatus = AXUIElementIsAttributeSettable(element, kAXValueAttribute as CFString, &valueSettable)
    let settableText = settableStatus == .success ? (valueSettable.boolValue ? "true" : "false") : "n/a"

    var actionNames: CFArray?
    let actionsStatus = AXUIElementCopyActionNames(element, &actionNames)
    let actionText: String
    if actionsStatus == .success, let actions = actionNames as? [String], !actions.isEmpty {
        actionText = actions.joined(separator: ",")
    } else {
        actionText = ""
    }

    let parts = [
        "role=\(role)",
        title.isEmpty ? nil : "title=\(title)",
        description.isEmpty ? nil : "desc=\(description)",
        valueText.isEmpty ? nil : "value=\(valueText)",
        "settable=\(settableText)",
        frameText(element),
        actionText.isEmpty ? nil : "actions=\(actionText)"
    ].compactMap { $0 }

    lines.append("\(indent)\(parts.joined(separator: " | "))")

    let children = cfArray(copyAttribute(element, kAXChildrenAttribute as CFString), as: AXUIElement.self)
    for child in children {
        dumpElement(child, depth: depth + 1, maxDepth: maxDepth, lines: &lines)
    }
}

func describeElement(_ element: AXUIElement) -> String {
    let role = roleOf(element)
    let title = titleOf(element)
    let description = (copyAttribute(element, kAXDescriptionAttribute as CFString) as? String) ?? ""
    let value = copyAttribute(element, kAXValueAttribute as CFString)
    var valueText = ""
    if let text = value as? String {
        valueText = text.replacingOccurrences(of: "\n", with: "\\n")
    } else if let number = value as? NSNumber {
        valueText = number.stringValue
    }

    var valueSettable = DarwinBoolean(false)
    let settableStatus = AXUIElementIsAttributeSettable(element, kAXValueAttribute as CFString, &valueSettable)
    let settableText = settableStatus == .success ? (valueSettable.boolValue ? "true" : "false") : "n/a"

    var actionNames: CFArray?
    let actionsStatus = AXUIElementCopyActionNames(element, &actionNames)
    let actionText: String
    if actionsStatus == .success, let actions = actionNames as? [String], !actions.isEmpty {
        actionText = actions.joined(separator: ",")
    } else {
        actionText = ""
    }

    return [
        "role=\(role)",
        title.isEmpty ? nil : "title=\(title)",
        description.isEmpty ? nil : "desc=\(description)",
        valueText.isEmpty ? nil : "value=\(valueText)",
        "settable=\(settableText)",
        frameText(element),
        actionText.isEmpty ? nil : "actions=\(actionText)"
    ].compactMap { $0 }.joined(separator: " | ")
}

func dumpTopLevel(window: AXUIElement) -> String {
    var lines: [String] = []
    let topChildren = cfArray(copyAttribute(window, kAXChildrenAttribute as CFString), as: AXUIElement.self)
    for (index, child) in topChildren.enumerated() {
        lines.append("UI \(index + 1): \(describeElement(child))")

        if roleOf(child) == kAXScrollAreaRole as String {
            let scrollChildren = cfArray(copyAttribute(child, kAXChildrenAttribute as CFString), as: AXUIElement.self)
            for (subIndex, subChild) in scrollChildren.enumerated() {
                lines.append("  CHILD \(subIndex + 1): \(describeElement(subChild))")
            }
        }
    }
    return lines.joined(separator: "\n")
}

func dumpTopWindow(title: String?) throws -> String {
    try ensureTrusted()
    let app = try kakaoApp()
    let appElement = axAppElement(app)
    let window: AXUIElement
    if let title, let named = namedWindow(appElement, title: title) {
        window = named
    } else if title != nil {
        throw NativeError.message("지정한 창을 찾지 못했습니다.")
    } else {
        window = try mainWindow(appElement)
    }
    return dumpTopLevel(window: window)
}

func pressTopChild(title: String?, index: Int) throws -> Bool {
    try ensureTrusted()
    let app = try kakaoApp()
    let appElement = axAppElement(app)
    let window: AXUIElement
    if let title, let named = namedWindow(appElement, title: title) {
        window = named
    } else if title != nil {
        throw NativeError.message("지정한 창을 찾지 못했습니다.")
    } else {
        window = try mainWindow(appElement)
    }

    let topChildren = cfArray(copyAttribute(window, kAXChildrenAttribute as CFString), as: AXUIElement.self)
    let normalizedIndex = index - 1
    guard normalizedIndex >= 0, normalizedIndex < topChildren.count else {
        throw NativeError.message("지정한 top child index가 범위를 벗어났습니다.")
    }

    let target = topChildren[normalizedIndex]
    let result = AXUIElementPerformAction(target, kAXPressAction as CFString)
    guard result == .success else {
        throw NativeError.message("지정한 top child를 누르지 못했습니다.")
    }
    return true
}

func stringValues(in element: AXUIElement, depth: Int = 0, maxDepth: Int = 5) -> [String] {
    if depth > maxDepth {
        return []
    }

    var values: [String] = []
    for attribute in [kAXValueAttribute, kAXTitleAttribute, kAXDescriptionAttribute] {
        if let value = copyAttribute(element, attribute as CFString) {
            if let text = value as? String {
                let trimmed = text.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
                if !trimmed.isEmpty && trimmed != "missing value" {
                    values.append(trimmed)
                }
            } else if let number = value as? NSNumber {
                values.append(number.stringValue)
            }
        }
    }

    let children = cfArray(copyAttribute(element, kAXChildrenAttribute as CFString), as: AXUIElement.self)
    for child in children {
        values.append(contentsOf: stringValues(in: child, depth: depth + 1, maxDepth: maxDepth))
    }
    return values
}

func normalizeParts(_ parts: [String]) -> [String] {
    var result: [String] = []
    for part in parts {
        let trimmed = part.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            continue
        }
        if result.last == trimmed {
            continue
        }
        result.append(trimmed)
    }
    return result
}

func isUiNoise(_ text: String) -> Bool {
    let value = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if value.isEmpty {
        return true
    }

    return value == "profile"
        || value == "button"
        || value == "notifications"
        || value == "settings"
        || value == "chats"
        || value == "chatroom folder"
        || value == "search"
        || value == "add chatroom"
        || value == "common icon triangledown"
        || value == "common icon newdot"
        || value.hasPrefix("chatlist icon")
        || value.hasPrefix("badge ")
}

func visibleTextLines(in element: AXUIElement) -> [String] {
    normalizeParts(stringValues(in: element)).filter { !isUiNoise($0) }
}

func readVisibleMessages(title: String, limit: Int, mode: String) throws -> [[String]] {
    try ensureTrusted()
    let app = try kakaoApp()
    let appElement = axAppElement(app)
    guard let window = namedWindow(appElement, title: title) else {
        throw NativeError.message("지정한 채팅창을 찾지 못했습니다.")
    }
    guard let table = messageTable(window: window) else {
        throw NativeError.message("메시지 테이블을 찾지 못했습니다.")
    }

    let rows = cfArray(copyAttribute(table, kAXRowsAttribute as CFString), as: AXUIElement.self)
    let clampedLimit = max(1, limit)
    let selectedRows: ArraySlice<AXUIElement>
    if mode.lowercased() == "head" {
        selectedRows = rows.prefix(clampedLimit)
    } else {
        selectedRows = rows.suffix(clampedLimit)
    }
    return selectedRows
        .map { visibleTextLines(in: $0) }
        .filter { !$0.isEmpty }
}

func scrollVisibleMessages(title: String, direction: String) throws -> Bool {
    try ensureTrusted()
    let app = try kakaoApp()
    let appElement = axAppElement(app)
    guard let window = namedWindow(appElement, title: title) else {
        throw NativeError.message("지정한 채팅창을 찾지 못했습니다.")
    }
    guard let scrollArea = messageScrollArea(window: window) else {
        throw NativeError.message("메시지 스크롤 영역을 찾지 못했습니다.")
    }

    if let scrollBar = firstScrollBar(in: scrollArea),
       let currentValue = copyAttribute(scrollBar, kAXValueAttribute as CFString) as? NSNumber {
        let current = currentValue.doubleValue
        let delta = direction.lowercased() == "up" ? -0.12 : 0.12
        let next = max(0.0, min(1.0, current + delta))
        if setAttribute(scrollBar, kAXValueAttribute as CFString, NSNumber(value: next)) {
            usleep(450_000)
            return true
        }
    }

    let action = direction.lowercased() == "up" ? "AXScrollUpByPage" : "AXScrollDownByPage"
    let result = AXUIElementPerformAction(scrollArea, action as CFString)
    if result != .success {
        throw NativeError.message("메시지 스크롤에 실패했습니다.")
    }
    usleep(350_000)
    return true
}

func roomState(title: String) throws -> [String: Double] {
    try ensureTrusted()
    let app = try kakaoApp()
    let appElement = axAppElement(app)
    guard let window = namedWindow(appElement, title: title) else {
        throw NativeError.message("지정한 채팅창을 찾지 못했습니다.")
    }
    guard let table = messageTable(window: window) else {
        throw NativeError.message("메시지 테이블을 찾지 못했습니다.")
    }
    let rows = cfArray(copyAttribute(table, kAXRowsAttribute as CFString), as: AXUIElement.self)
    var result: [String: Double] = ["rowCount": Double(rows.count)]
    if let scrollArea = messageScrollArea(window: window),
       let scrollBar = firstScrollBar(in: scrollArea),
       let value = copyAttribute(scrollBar, kAXValueAttribute as CFString) as? NSNumber {
        result["scrollValue"] = value.doubleValue
    }
    return result
}

func isDateOrTime(_ text: String) -> Bool {
    let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if value.isEmpty { return false }
    let patterns = [
        #"^\d{1,2}:\d{2}(\s?[AP]M)?$"#,
        #"^\d{1,2}/\d{1,2}/\d{2,4}$"#,
        #"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$"#,
        #"^(오전|오후)\s*\d{1,2}:\d{2}$"#,
        #"^(today|yesterday)$"#
    ]

    return patterns.contains { pattern in
        value.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }
}

func isUnreadCount(_ text: String) -> Bool {
    text.range(of: #"^\d+$"#, options: .regularExpression) != nil
}

func isDecorativePart(_ text: String) -> Bool {
    let value = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return value == "profile"
        || value == "badge openchat room"
        || value.hasPrefix("chatlist icon")
}

func roomName(from parts: [String]) -> String {
    var nameParts: [String] = []
    for part in parts {
        if isDecorativePart(part) {
            continue
        }
        if isUnreadCount(part) || isDateOrTime(part) {
            break
        }
        nameParts.append(part)
    }
    return nameParts.isEmpty ? (parts.first ?? "") : nameParts.joined(separator: ", ")
}

func lastActivity(from parts: [String]) -> String {
    for part in parts.reversed() {
        if isDateOrTime(part) {
            return part
        }
    }
    return ""
}

func listRooms(limit: Int) throws -> [Room] {
    try ensureTrusted()
    let app = try kakaoApp()
    try activateChatTab(app)

    let window = try mainWindow(axAppElement(app))
    guard let container = findListContainer(window: window) else {
        throw NativeError.message("채팅 목록 컨테이너를 찾지 못했습니다.")
    }

    let rows = cfArray(copyAttribute(container, kAXRowsAttribute as CFString), as: AXUIElement.self)
    var output: [Room] = []
    for (index, row) in rows.prefix(limit).enumerated() {
        let parts = normalizeParts(stringValues(in: row))
        let name = roomName(from: parts)
        if name.isEmpty || name == "KakaoTalk" {
            continue
        }

        output.append(Room(
            id: parts.joined(separator: "||"),
            rowIndex: index + 1,
            roomName: name,
            lastActivity: lastActivity(from: parts),
            rawParts: parts
        ))
    }
    return output
}

func openRoom(name: String, limit: Int) throws -> Bool {
    try ensureTrusted()
    let app = try kakaoApp()
    try activateChatTab(app)

    let window = try mainWindow(axAppElement(app))
    guard let container = findListContainer(window: window) else {
        throw NativeError.message("채팅 목록 컨테이너를 찾지 못했습니다.")
    }

    let rows = cfArray(copyAttribute(container, kAXRowsAttribute as CFString), as: AXUIElement.self)
    let targetIndex = rows.prefix(limit).enumerated().first { _, row in
        let parts = normalizeParts(stringValues(in: row))
        let room = roomName(from: parts)
        return room == name || room.contains(name) || name.contains(room)
    }?.offset

    guard let index = targetIndex else {
        return false
    }

    let row = rows[index]
    _ = setAttribute(row, kAXSelectedAttribute as CFString, kCFBooleanTrue)
    usleep(150_000)
    try keyEvent(keyCode: 36) // Return
    usleep(400_000)
    return true
}

func sendText(_ text: String) throws -> Bool {
    try ensureTrusted()
    _ = try kakaoApp()

    let pasteboard = NSPasteboard.general
    pasteboard.clearContents()
    pasteboard.setString(text, forType: .string)

    usleep(150_000)
    try keyEvent(keyCode: 9, flags: .maskCommand) // cmd+v
    usleep(120_000)
    try keyEvent(keyCode: 36) // Return
    return true
}

func listWindowTitles() throws -> [String] {
    try ensureTrusted()
    let app = try kakaoApp()
    return allWindows(axAppElement(app))
        .map { titleOf($0).trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
}

func dumpWindow(title: String?) throws -> String {
    try ensureTrusted()
    let app = try kakaoApp()
    let appElement = axAppElement(app)
    let window: AXUIElement
    if let title, let named = namedWindow(appElement, title: title) {
        window = named
    } else if title != nil {
        throw NativeError.message("지정한 창을 찾지 못했습니다.")
    } else {
        window = try mainWindow(appElement)
    }

    var lines: [String] = []
    dumpElement(window, lines: &lines)
    return lines.joined(separator: "\n")
}

func readWindowText(title: String) throws -> [String] {
    try ensureTrusted()
    let app = try kakaoApp()
    let appElement = axAppElement(app)
    guard let window = namedWindow(appElement, title: title) else {
        throw NativeError.message("지정한 채팅창을 찾지 못했습니다.")
    }
    return visibleTextLines(in: window)
}

do {
    let args = Array(CommandLine.arguments.dropFirst())
    guard let command = args.first else {
        throw NativeError.message("명령이 필요합니다.")
    }

    switch command {
    case "list-rooms":
        let limit = Int(args.dropFirst().first ?? "20") ?? 20
        let rooms = try listRooms(limit: limit)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
        let data = try encoder.encode(rooms)
        FileHandle.standardOutput.write(data)
    case "open-room":
        guard args.count >= 2 else {
            throw NativeError.message("open-room 에는 방 이름이 필요합니다.")
        }
        let name = args[1]
        let limit = Int(args.dropFirst(2).first ?? "20") ?? 20
        let ok = try openRoom(name: name, limit: limit)
        print(ok ? "1" : "0")
    case "send-text":
        guard args.count >= 2 else {
            throw NativeError.message("send-text 에는 메시지가 필요합니다.")
        }
        let ok = try sendText(args[1])
        print(ok ? "1" : "0")
    case "list-windows":
        let titles = try listWindowTitles()
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
        let data = try encoder.encode(titles)
        FileHandle.standardOutput.write(data)
    case "dump-window":
        let title = args.dropFirst().first
        print(try dumpWindow(title: title))
    case "dump-top":
        let title = args.dropFirst().first
        print(try dumpTopWindow(title: title))
    case "press-top-child":
        guard args.count >= 3 else {
            throw NativeError.message("press-top-child 는 창 제목과 index가 필요합니다.")
        }
        let ok = try pressTopChild(title: args[1], index: Int(args[2]) ?? 0)
        print(ok ? "1" : "0")
    case "read-window-text":
        guard args.count >= 2 else {
            throw NativeError.message("read-window-text 에는 창 제목이 필요합니다.")
        }
        let lines = try readWindowText(title: args[1])
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
        let data = try encoder.encode(lines)
        FileHandle.standardOutput.write(data)
    case "read-room-messages":
        guard args.count >= 2 else {
            throw NativeError.message("read-room-messages 에는 창 제목이 필요합니다.")
        }
        let limit = Int(args.dropFirst(2).first ?? "80") ?? 80
        let mode = args.dropFirst(3).first ?? "tail"
        let rows = try readVisibleMessages(title: args[1], limit: limit, mode: mode)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
        let data = try encoder.encode(rows)
        FileHandle.standardOutput.write(data)
    case "scroll-room":
        guard args.count >= 3 else {
            throw NativeError.message("scroll-room 은 창 제목과 방향이 필요합니다.")
        }
        let ok = try scrollVisibleMessages(title: args[1], direction: args[2])
        print(ok ? "1" : "0")
    case "room-state":
        guard args.count >= 2 else {
            throw NativeError.message("room-state 는 창 제목이 필요합니다.")
        }
        let state = try roomState(title: args[1])
        let data = try JSONSerialization.data(withJSONObject: state, options: [.prettyPrinted])
        FileHandle.standardOutput.write(data)
    default:
        throw NativeError.message("알 수 없는 명령: \(command)")
    }
} catch {
    FileHandle.standardError.write(Data((String(describing: error) + "\n").utf8))
    exit(1)
}
