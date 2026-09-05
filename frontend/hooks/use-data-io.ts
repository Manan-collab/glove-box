import { useMutation, useQueryClient } from "@tanstack/react-query";
import { downloadExport, downloadTemplate, uploadImport } from "@/lib/data-io-api";

export function useImportWorkbook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cars"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useExportWorkbook() {
  return useMutation({ mutationFn: downloadExport });
}

export function useDownloadTemplate() {
  return useMutation({ mutationFn: downloadTemplate });
}
