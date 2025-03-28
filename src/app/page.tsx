'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/store/sessionStore';
import * as api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import LoadingSpinner from '@/components/LoadingSpinner';

export default function UploadPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { sessionId, loadingState, loadingMessage, setLoading, setSessionId, setVectorStoreId, setError, resetSession } = useSessionStore();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      toast({ title: "No files selected", description: "Please select documents to upload.", variant: "destructive" });
      return;
    }

    setLoading('loading', 'Starting session...');
    setError(null); // Clear previous errors

    try {
      // 1. Start a new session
      const sessionResponse = await api.startSession();
      setSessionId(sessionResponse.session_id);
      const currentSessionId = sessionResponse.session_id; // Use current ID for subsequent calls

      // 2. Upload documents
      setLoading('loading', `Uploading ${selectedFiles.length} document(s)...`);
      const uploadResponse = await api.uploadDocuments(currentSessionId, selectedFiles);
      setVectorStoreId(uploadResponse.vector_store_id); // Assuming API returns this

      toast({ title: "Upload Successful", description: `${uploadResponse.files_uploaded.length} file(s) processed.` });

      // 3. Trigger generation steps (could be combined with upload on backend)
      setLoading('loading', 'Analyzing documents and preparing lesson...');
      // Depending on backend design, you might trigger plan and content separately
      // or just navigate and let the next page poll/wait.
      // Example: Triggering plan generation, content might be triggered automatically or on next step page.
      await api.triggerPlanGeneration(currentSessionId);
      // Optionally trigger content immediately, or handle on next page
      // await api.triggerContentGeneration(currentSessionId);

      setLoading('success', 'Preparation complete!');

      // 4. Navigate to the lesson page (or a generation status page first)
      router.push(`/session/${currentSessionId}/lesson`); // Navigate to lesson page

    } catch (error: any) {
      console.error("Upload failed:", error);
      const errorMessage = error.response?.data?.detail || error.message || 'An unknown error occurred during upload.';
      setError(`Upload failed: ${errorMessage}`);
      setLoading('error');
      toast({ title: "Upload Failed", description: errorMessage, variant: "destructive" });
      // Optionally reset session ID if creation failed partially
      // resetSession();
    }
  }, [selectedFiles, router, setLoading, setSessionId, setVectorStoreId, setError, toast, resetSession]);

  // Reset session if navigating back to upload page
  React.useEffect(() => {
    if (sessionId) {
        // Optional: Decide if you want to reset automatically when visiting '/'
        // resetSession();
        // console.log("Session reset on visiting upload page.");
    }
  }, [sessionId, resetSession]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>AI Tutor Setup</CardTitle>
          <CardDescription>Upload your documents to start learning.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingState === 'loading' ? (
            <LoadingSpinner message={loadingMessage} />
          ) : (
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="documents">Documents</Label>
                <Input
                  id="documents"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  disabled={loadingState === 'loading'}
                />
              </div>
              {selectedFiles.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Selected files:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground max-h-32 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <li key={index}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
               {useSessionStore.getState().error && (
                 <p className="text-sm text-red-600">{useSessionStore.getState().error}</p>
               )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || loadingState === 'loading'}
            className="w-full"
          >
            {loadingState === 'loading' ? 'Processing...' : 'Start Learning'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
