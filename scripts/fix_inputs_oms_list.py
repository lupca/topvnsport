import os

file = "OMS/frontend/src/components/ProductList.tsx"

if os.path.exists(file):
    with open(file, 'r') as f:
        content = f.read()
    
    # Text input search
    content = content.replace('className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"',
                              'className="w-full bg-slate-950 pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-slate-100"')
                              
    with open(file, 'w') as f:
        f.write(content)
    print(f"Updated {file}")
else:
    print(f"Not found: {file}")

