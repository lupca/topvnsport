import os

files = [
    "PMI/frontend/src/app/settings/roles/page.tsx",
    "PMI/frontend/src/app/settings/users/page.tsx",
    "PMI/frontend/src/app/catalog/page.tsx",
    "OMS/frontend/src/app/(desktop)/orders/page.tsx",
    "OMS/frontend/src/components/ProductForm.tsx",
    "OMS/frontend/src/components/layout/Topbar.tsx",
    "OMS/frontend/src/components/ProductList.tsx"
]

replacements = {
    "bg-white": "bg-slate-900",
    "bg-slate-50": "bg-slate-950",
    "bg-slate-100": "bg-slate-800",
    "border-slate-100": "border-slate-800",
    "border-slate-200": "border-slate-700",
    "text-slate-800": "text-slate-100",
    "text-slate-700": "text-slate-200",
    "text-slate-600": "text-slate-300"
}

for file in files:
    if os.path.exists(file):
        with open(file, 'r') as f:
            content = f.read()
        
        # We need to be careful not to replace already converted ones, but since we are converting from light to dark, it's safe.
        # But wait! text-slate-800 -> text-slate-100. If there's already text-slate-100 it's fine.
        for k, v in replacements.items():
            content = content.replace(k, v)
            
        with open(file, 'w') as f:
            f.write(content)
        print(f"Updated {file}")
    else:
        print(f"Not found: {file}")

