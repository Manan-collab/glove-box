"use client";

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useRef, useState } from "react";
import {
  useDownloadTemplate,
  useExportWorkbook,
  useImportWorkbook,
} from "@/hooks/use-data-io";
import type { ImportResult } from "@/lib/data-io-api";

interface DataIoDialogProps {
  open: boolean;
  onClose: () => void;
}

export function DataIoDialog({ open, onClose }: DataIoDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const downloadTemplate = useDownloadTemplate();
  const exportWorkbook = useExportWorkbook();
  const importWorkbook = useImportWorkbook();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file again later
    if (!file) return;
    setResult(null);
    importWorkbook.mutate(file, { onSuccess: setResult });
  };

  const anyError =
    exportWorkbook.error ?? downloadTemplate.error ?? importWorkbook.error;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ transition: { onExited: () => setResult(null) } }}
    >
      <DialogTitle>Import / Export</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
            Export your garage to Excel, or bulk-import cars and expenses from a
            spreadsheet — one sheet per car. New to this? Start from the template.
          </Typography>

          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              disabled={exportWorkbook.isPending}
              onClick={() => exportWorkbook.mutate()}
            >
              {exportWorkbook.isPending ? "Exporting…" : "Export my data"}
            </Button>
            <Button
              variant="outlined"
              disabled={downloadTemplate.isPending}
              onClick={() => downloadTemplate.mutate()}
            >
              {downloadTemplate.isPending ? "Downloading…" : "Download template"}
            </Button>
            <Button
              variant="contained"
              disabled={importWorkbook.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {importWorkbook.isPending ? "Importing…" : "Import from Excel"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              hidden
              onChange={handleFileChange}
            />
          </Stack>

          {anyError && <Alert severity="error">{anyError.message}</Alert>}

          {result && (
            <Box>
              <Alert severity={result.errors.length > 0 ? "warning" : "success"}>
                {result.carsCreated} car{result.carsCreated === 1 ? "" : "s"} created,{" "}
                {result.carsUpdated} updated · {result.expensesCreated} expense
                {result.expensesCreated === 1 ? "" : "s"} created,{" "}
                {result.expensesUpdated} updated
                {result.errors.length > 0 &&
                  ` · ${result.errors.length} issue${result.errors.length === 1 ? "" : "s"}`}
              </Alert>
              {result.errors.length > 0 && (
                <Stack
                  spacing={0.75}
                  sx={{
                    mt: 1.5,
                    maxHeight: 220,
                    overflowY: "auto",
                    bgcolor: "background.default",
                    borderRadius: "8px",
                    p: 1.5,
                  }}
                >
                  {result.errors.map((err, index) => (
                    <Typography key={index} sx={{ fontSize: 12.5, color: "text.secondary" }}>
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        {err.sheet}
                      </Box>
                      {err.row ? ` (row ${err.row})` : ""}: {err.message}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
