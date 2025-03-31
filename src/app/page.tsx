'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SessionState, useSessionStore } from '@/store/sessionStore';
import { shallow } from 'zustand/shallow';
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
  
  const sessionId = useSessionStore((state) => state.sessionId);
  const loadingState = useSessionStore((state) => state.loadingState);
  const loadingMessage = useSessionStore((state) => state.loadingMessage);
  const error = useSessionStore((state) => state.error);
  const setLoading = useSessionStore((state) => state.setLoading);
  const setSessionId = useSessionStore((state) => state.setSessionId);
  const setVectorStoreId = useSessionStore((state) => state.setVectorStoreId);
  const setError = useSessionStore((state) => state.setError);
  const resetSession = useSessionStore((state) => state.resetSession);
  const setLoadingMessage = useSessionStore((state) => state.setLoadingMessage);

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

    setLoading('loading');
    setLoadingMessage('Starting session...');
    setError(null);

    try {
      const sessionResponse = await api.startSession();
      setSessionId(sessionResponse.session_id);
      const currentSessionId = sessionResponse.session_id;

      setLoading('loading');
      setLoadingMessage(`Uploading ${selectedFiles.length} document(s)...`);
      const uploadResponse = await api.uploadDocuments(currentSessionId, selectedFiles);
      
      console.log('Upload response:', uploadResponse);
      
      if (!uploadResponse) {
        throw new Error('No response received from server');
      }
      
      if (!uploadResponse.vector_store_id) {
        console.error('Invalid upload response:', uploadResponse);
        throw new Error('Server response missing vector_store_id');
      }
      
      setVectorStoreId(uploadResponse.vector_store_id);

      const filesProcessed = uploadResponse.files_received?.length || 0;
      toast({ title: "Upload Successful", description: `${filesProcessed} file(s) processed.` });

      setLoading('loading');
      setLoadingMessage('Analyzing documents and preparing lesson...');

      setLoading('success');
      setLoadingMessage('Preparation complete!');

      router.push(`/session/${currentSessionId}/learn`);

    } catch (error: any) {
      console.error("Upload failed:", error);
      const errorMessage = error.response?.data?.detail || error.message || 'An unknown error occurred during upload.';
      setError(`Upload failed: ${errorMessage}`);
      setLoading('error');
      setLoadingMessage('An error occurred.');
      toast({ title: "Upload Failed", description: errorMessage, variant: "destructive" });
    }
  }, [selectedFiles, router, setLoading, setSessionId, setVectorStoreId, setError, toast, setLoadingMessage]);

  React.useEffect(() => {
    if (sessionId) {
        // Optional: Decide if you want to reset automatically when visiting '/'
        // resetSession();
        // console.log("Session reset on visiting upload page.");
    }
  }, [sessionId]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>AI Tutor Setup</CardTitle>
          <CardDescription>Upload your documents to start learning.</CardDescription>
        </CardHeader>
        <CardContent>
          {!(loadingState === 'idle' || loadingState === 'success' || loadingState === 'error') ? (
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
                  disabled={!(loadingState === 'idle' || loadingState === 'success' || loadingState === 'error')}
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
               {error && (
                 <p className="text-sm text-red-600">{error}</p>
               )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || !(loadingState === 'idle' || loadingState === 'success' || loadingState === 'error')}
            className="w-full"
          >
            {!(loadingState === 'idle' || loadingState === 'success' || loadingState === 'error') ? 'Processing...' : 'Start Learning'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
