import { fetchWithRefresh, throwApiError } from "./api-client";

export interface RowError {
  sheet: string;
  row?: number;
  message: string;
}

export interface ImportResult {
  carsCreated: number;
  carsUpdated: number;
  expensesCreated: number;
  expensesUpdated: number;
  errors: RowError[];
}

export async function uploadImport(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);

  // No explicit Content-Type — the browser sets multipart/form-data with the
  // correct boundary itself; setting it manually would break the upload.
  const res = await fetchWithRefresh("/data-io/import", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    return throwApiError(res);
  }
  return res.json() as Promise<ImportResult>;
}

async function downloadBlob(path: string, filename: string): Promise<void> {
  const res = await fetchWithRefresh(path);
  if (!res.ok) {
    return throwApiError(res);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadExport(): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  return downloadBlob("/data-io/export", `glovebox-export-${date}.xlsx`);
}

export function downloadTemplate(): Promise<void> {
  return downloadBlob("/data-io/template", "glovebox-import-template.xlsx");
}
