import sys
import re

def main():
    try:
        with open("src-tauri/target/release/version/UmaReceiptCapture_v1.01.exe", "rb") as f:
            data = f.read()
            
            # Since it's a bundled exe, strings might be UTF-8
            # Let's search for "オートキャプチャ & 自動結合" encoded in UTF-8
            target = "オートキャプチャ & 自動結合".encode('utf-8')
            idx = data.find(target)
            
            if idx == -1:
                print("Target string not found.")
                return
                
            # Extract 2000 bytes before and 4000 bytes after
            start = max(0, idx - 2000)
            end = min(len(data), idx + 4000)
            
            chunk = data[start:end]
            
            # Print the chunk ignoring decoding errors
            print(chunk.decode('utf-8', errors='ignore'))
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
