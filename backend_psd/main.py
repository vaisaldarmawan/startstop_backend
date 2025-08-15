from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from obspy import read
from obspy.signal import PPSD
from obspy.core.inventory.inventory import read_inventory
import os
from typing import List

app = FastAPI()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/analyze/")
async def analyze_psd(
    station: str = Form(...),
    files: List[UploadFile] = File(...)
):
    try:
        for file in files:
            path = os.path.join(UPLOAD_DIR, file.filename)
            with open(path, "wb") as f:
                f.write(await file.read())

        mseed_path = os.path.join(UPLOAD_DIR, f"{station}_Z.mseed")
        st = read(mseed_path)
        tr = st.select(id=f"IA.{station}..HNZ")[0]

        inv = read_inventory(
            f"http://202.90.199.206:8080/fdsnws/station/1/query?station={station}&level=response&nodata=404"
        )

        ppsd = PPSD(tr.stats, metadata=inv, ppsd_length=300)
        ppsd.add(st)

        output_path = os.path.join(UPLOAD_DIR, f"{station}_ppsd.png")
        ppsd.plot(output_path)

        return FileResponse(output_path, media_type="image/png")

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
