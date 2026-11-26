# 1.5倍のキャラ（dot/chara15/。キャラのセッションが書き出す）を、ためしの画面（app/lab/chara15/parts/）へ写す
#   写すのは parts15.json と、絵（_ で始まる確かめ用は写さない）
#   使い方：python tools/chara15_sync.py
import shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent; SRC = ROOT / 'dot/chara15'; OUT = ROOT / 'app/lab/chara15/parts'
if OUT.exists(): shutil.rmtree(OUT)
n = 0
for f in SRC.rglob('*'):
    if f.is_file() and not f.name.startswith('_') and f.suffix in ('.png', '.json'):
        d = OUT / f.relative_to(SRC); d.parent.mkdir(parents=True, exist_ok=True); shutil.copy(f, d); n += 1
print(n, 'files →', OUT)
