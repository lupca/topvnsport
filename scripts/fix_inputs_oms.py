import os

file = "OMS/frontend/src/components/ProductForm.tsx"

if os.path.exists(file):
    with open(file, 'r') as f:
        content = f.read()
    
    # We will replace carefully for inputs without bg
    content = content.replace('className="w-full px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"',
                              'className="w-full bg-slate-950 px-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"')
                              
    content = content.replace('className="w-full px-4 py-2 bg-slate-900 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"',
                              'className="w-full bg-slate-950 px-4 py-2 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"')
                              
    content = content.replace('className="w-full pr-12 pl-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"',
                              'className="w-full bg-slate-950 pr-12 pl-4 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"')
                              
    with open(file, 'w') as f:
        f.write(content)
    print(f"Updated {file}")
else:
    print(f"Not found: {file}")

