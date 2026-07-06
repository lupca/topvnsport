import os

file = "OMS/frontend/src/components/layout/Topbar.tsx"

if os.path.exists(file):
    with open(file, 'r') as f:
        content = f.read()
    
    content = content.replace('bg-emerald-50 text-emerald-700', 'bg-emerald-950 text-emerald-400')
    content = content.replace('border-white', 'border-slate-900')
                              
    with open(file, 'w') as f:
        f.write(content)
    print(f"Updated {file}")
else:
    print(f"Not found: {file}")

