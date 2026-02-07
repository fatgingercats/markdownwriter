import urllib.request
import os

url = "https://github.com/yarnpkg/yarn/releases/download/v1.22.19/yarn-1.22.19.js"
filename = "yarn.js"

print(f"Downloading {url} to {filename}...")
try:
    urllib.request.urlretrieve(url, filename)
    print("Download successful!")
except Exception as e:
    print(f"Download failed: {e}")
