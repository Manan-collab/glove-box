"use client";

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useState } from "react";

interface AddNoteDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: string) => void;
  isSubmitting: boolean;
  error?: string;
}

export function AddNoteDialog({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: AddNoteDialogProps) {
  const [body, setBody] = useState("");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ transition: { onExited: () => setBody("") } }}
    >
      <DialogTitle>Add a note</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          placeholder="e.g. Noticed a slight vibration at highway speed"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          sx={{ mt: 0.5 }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!body.trim()}
          loading={isSubmitting}
          onClick={() => onSubmit(body.trim())}
        >
          Save Note
        </Button>
      </DialogActions>
    </Dialog>
  );
}
