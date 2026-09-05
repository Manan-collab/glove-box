import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createNote, deleteNote, listNotes } from "@/lib/notes-api";

const notesKey = (carId: string) => ["notes", carId] as const;

export function useCarNotes(carId: string) {
  return useQuery({
    queryKey: notesKey(carId),
    queryFn: () => listNotes(carId),
    enabled: !!carId,
  });
}

export function useCreateNote(carId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => createNote(carId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKey(carId) });
    },
  });
}

export function useDeleteNote(carId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKey(carId) });
    },
  });
}
