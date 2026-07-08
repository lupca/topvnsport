import os
from bs4 import BeautifulSoup

data_dir = "/home/lupca/Downloads/data topvnsport"
for filename in sorted(os.listdir(data_dir))[:1]:
    if not filename.endswith(".html"): continue
    filepath = os.path.join(data_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        html = f.read()
    soup = BeautifulSoup(html, "html.parser")
    # Let us find any h1 or spans that might be the title
    for span in soup.find_all("span"):
        if len(span.text) > 20:
            print(f"Span class {span.get('class')}: {span.text.strip()}")
