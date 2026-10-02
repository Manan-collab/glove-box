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
import type { ImportResult, RowError } from "@/lib/data-io-api";

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
              loading={exportWorkbook.isPending}
              onClick={() => exportWorkbook.mutate()}
            >
              Export my data
            </Button>
            <Button
              variant="outlined"
              loading={downloadTemplate.isPending}
              onClick={() => downloadTemplate.mutate()}
            >
              Download template
            </Button>
            <Button
              variant="contained"
              loading={importWorkbook.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              Import from Excel
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

          {result && <ImportResultSummary result={result} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

function ImportResultSummary({ result }: { result: ImportResult }) {
  const failed = result.errors.length > 0;
  return (
    <Stack spacing={1.5}>
      {failed ? (
        <Alert severity="error">
          Nothing was imported — the file has {plural(result.errors.length, "problem")}.
          Fix {result.errors.length === 1 ? "it" : "them"} in Excel and upload the
          file again.
        </Alert>
      ) : (
        <Alert severity={result.warnings.length > 0 ? "warning" : "success"}>
          Imported: {plural(result.carsCreated, "car")} created ·{" "}
          {plural(result.expensesCreated, "expense")} created,{" "}
          {result.expensesUpdated} updated
          {result.warnings.length > 0 &&
            ` · ${plural(result.warnings.length, "note")} below`}
        </Alert>
      )}
      {failed && <IssueList issues={result.errors} />}
      {result.warnings.length > 0 && (
        <>
          {failed && (
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "text.secondary" }}>
              Also worth checking:
            </Typography>
          )}
          <IssueList issues={result.warnings} />
        </>
      )}
    </Stack>
  );
}

function IssueList({ issues }: { issues: RowError[] }) {
  return (
    <Stack
      spacing={0.75}
      sx={{
        maxHeight: 220,
        overflowY: "auto",
        bgcolor: "background.default",
        borderRadius: "8px",
        p: 1.5,
      }}
    >
      {issues.map((issue, index) => (
        <Typography key={index} sx={{ fontSize: 12.5, color: "text.secondary" }}>
          <Box component="span" sx={{ fontWeight: 700 }}>
            {issue.sheet}
            {issue.cell ? ` › ${issue.cell}` : issue.row ? ` › row ${issue.row}` : ""}
          </Box>
          : {issue.message}
        </Typography>
      ))}
    </Stack>
  );
}
