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
import { useIsPhone } from "@/hooks/use-is-phone";
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
  const isPhone = useIsPhone();
  const [body, setBody] = useState("");

  return (
    <Dialog
      open={open}
      // Closing mid-save would hide the outcome, including an error.
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isPhone}
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
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
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
