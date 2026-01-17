"""Utilities for exporting dataframes to multiple formats."""

from __future__ import annotations

import io
from typing import Tuple

import pandas as pd


def make_download_buffers(df: pd.DataFrame) -> Tuple[io.BytesIO, io.BytesIO, io.BytesIO]:
    csv_buffer = io.BytesIO()
    json_buffer = io.BytesIO()
    excel_buffer = io.BytesIO()

    csv_buffer.write(df.to_csv(index=False).encode("utf-8"))
    json_buffer.write(df.to_json(orient="records", indent=2).encode("utf-8"))

    with pd.ExcelWriter(excel_buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)

    csv_buffer.seek(0)
    json_buffer.seek(0)
    excel_buffer.seek(0)
    return csv_buffer, json_buffer, excel_buffer


__all__ = ["make_download_buffers"]
