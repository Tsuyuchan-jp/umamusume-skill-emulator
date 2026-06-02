import re
import sys

def extract_strings(filepath):
    try:
        with open(filepath, 'rb') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # Look for common tailwind class patterns that we know are in the UI
    # We're looking for strings that contain 'bg-' or 'flex' or 'rounded'
    # The compiled JS will have e.g. "className:\"flex flex-col...\""
    
    # Let's search for the Japanese text first (UTF-8 encoded)
    target = "オートキャプチャ & 自動結合".encode('utf-8')
    pos = content.find(target)
    
    if pos != -1:
        print(f"Found target Japanese string at offset {pos}!")
        start = max(0, pos - 2000)
        end = min(len(content), pos + 2000)
        snippet = content[start:end]
        # Print a sanitized version of the bytes around it
        print(snippet.decode('utf-8', errors='ignore'))
    else:
        print("Target Japanese string not found. It might be compressed or encoded differently.")
        
        # Search for Lucide icon imports or class names
        target2 = b"lucide-react"
        pos2 = content.find(target2)
        if pos2 != -1:
            print(f"Found lucide-react at {pos2}")
            
        target3 = b"bg-emerald-600"
        pos3 = content.find(target3)
        if pos3 != -1:
            print(f"Found bg-emerald-600 at {pos3}")
            start = max(0, pos3 - 2000)
            end = min(len(content), pos3 + 2000)
            print(content[start:end].decode('utf-8', errors='ignore'))
            
if __name__ == '__main__':
    extract_strings(r"C:\Users\PC1\Documents\google antigravity\Umamusume-Auto-DB\src-tauri\target\release\version\UmaReceiptCapture_v1.01.exe")
