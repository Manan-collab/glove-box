import { apiClient } from "./api-client";

export interface CarNote {
  id: string;
  carId: string;
  body: string;
  createdAt: string;
}

export function listNotes(carId: string) {
  return apiClient.get<CarNote[]>(`/cars/${carId}/notes`);
}

export function createNote(carId: string, body: string) {
  return apiClient.post<CarNote>(`/cars/${carId}/notes`, { body });
}

export function deleteNote(id: string) {
  return apiClient.del(`/notes/${id}`);
}
