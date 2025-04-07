'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SessionState, useSessionStore } from '@/store/sessionStore';
import { shallow } from 'zustand/shallow';
import * as api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import AuthForm from '@/components/AuthForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { FolderPlus, Folder as FolderIcon } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { FolderResponse } from '@/lib/types';
import { Separator } from '@/components/ui/separator';

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<FolderResponse[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [pageLoading, setPageLoading] = useState(true);

  const loadingState = useSessionStore((state) => state.loadingState);
  const loadingMessage = useSessionStore((state) => state.loadingMessage);
  const error = useSessionStore((state) => state.error);
  const setLoading = useSessionStore((state) => state.setLoading);
  const setSessionId = useSessionStore((state) => state.setSessionId);
  const setVectorStoreId = useSessionStore((state) => state.setVectorStoreId);
  const setSelectedFolderIdStore = useSessionStore((state) => state.setSelectedFolderId);
  const setError = useSessionStore((state) => state.setError);
  const resetSession = useSessionStore((state) => state.resetSession);
  const setLoadingMessage = useSessionStore((state) => state.setLoadingMessage);

  useEffect(() => {
    if (user) {
      setPageLoading(true);
      api.getFolders()
        .then(setFolders)
        .catch(err => {
          console.error("Failed to fetch folders:", err);
          toast({ title: "Error", description: "Could not fetch your folders.", variant: "destructive" });
        })
        .finally(() => setPageLoading(false));
    } else {
      setPageLoading(false);
    }
  }, [user, toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  const handleStartLearning = useCallback(async () => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "Please log in to start a session.", variant: "destructive" });
      return;
    }
    if (!selectedFolderId) {
      toast({ title: "No Folder Selected", description: "Please select or create a folder first.", variant: "destructive" });
      return;
    }
    if (selectedFiles.length === 0) {
      toast({ title: "No files selected", description: "Please select documents to upload.", variant: "destructive" });
      return;
    }

    setLoading('loading');
    setSelectedFolderIdStore(selectedFolderId);
    resetSession();
    setLoadingMessage('Starting session...');
    setError(null);

    try {
      const sessionResponse = await api.startSession(selectedFolderId);
      setSessionId(sessionResponse.session_id.toString());
      const currentSessionId = sessionResponse.session_id.toString();

      setLoading('loading');
      setLoadingMessage(`Uploading ${selectedFiles.length} document(s) for session ${currentSessionId}...`);
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

      toast({ title: "Upload Successful", description: `${uploadResponse.files_received.length} file(s) processed.` });

      setLoading('loading');
      setLoadingMessage('Analyzing documents and preparing lesson...');

      await api.triggerPlanGeneration(currentSessionId);

      setLoading('success');
      setLoadingMessage('Preparation complete!');

      router.push(`/session/${sessionResponse.session_id}/learn`);

    } catch (error: any) {
      console.error("Upload failed:", error);
      const errorMessage = error.response?.data?.detail || error.message || 'An unknown error occurred during upload.';
      const finalMessage = error.response?.status === 401 ? "Authentication failed. Please check your API key." : errorMessage;
      setError(`Upload failed: ${finalMessage}`);
      setLoading('error');
      setLoadingMessage('An error occurred.');
      toast({ title: "Upload Failed", description: errorMessage, variant: "destructive" });
      resetSession();
    }
  }, [user, selectedFolderId, selectedFiles, router, setLoading, setSessionId, setVectorStoreId, setSelectedFolderIdStore, setError, toast, setLoadingMessage, resetSession]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      toast({ title: "Folder name required", variant: "destructive" });
      return;
    }
    setIsCreatingFolder(true);
    try {
      const newFolder = await api.createFolder({ name: newFolderName });
      setFolders(prev => [newFolder, ...prev]);
      setSelectedFolderId(newFolder.id.toString());
      setNewFolderName('');
      toast({ title: "Folder Created", description: `\"${newFolder.name}\" created successfully.` });
    } catch (error: any) {
      console.error("Folder creation failed:", error);
      toast({ title: "Folder Creation Failed", description: error.message || "Could not create folder.", variant: "destructive" });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  if (authLoading || pageLoading) {
    return <LoadingSpinner message="Loading authentication..." />;
  }

  return (
    <div className="flex justify-center items-center min-h-screen">
      {!user ? (
        <AuthForm />
      ) : (
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>AI Tutor Dashboard</CardTitle>
            <CardDescription>Select a folder and upload documents to begin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="folder-select">Select Folder</Label>
              <div className="flex gap-2 mt-1">
                <select
                  id="folder-select"
                  value={selectedFolderId ?? ''}
                  onChange={(e) => setSelectedFolderId(e.target.value || null)}
                  className="flex-grow p-2 border rounded-md bg-transparent disabled:opacity-50"
                  disabled={folders.length === 0 || loadingState === 'loading' || loadingState === 'interacting'}
                >
                  <option value="" disabled>-- Select a folder --</option>
                  {folders.map(folder => (
                    <option key={folder.id.toString()} value={folder.id.toString()}>{folder.name}</option>
                  ))}
                </select>
                <Button variant="outline" size="icon" onClick={() => setSelectedFolderId(null)} title="Deselect Folder" disabled={!selectedFolderId}>
                  <FolderIcon className="h-4 w-4" />
                </Button>
              </div>
              {folders.length === 0 && <p className="text-xs text-muted-foreground mt-1">No folders found. Create one below.</p>}
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-2">
              <Label htmlFor="new-folder-name">Create New Folder</Label>
              <div className="flex gap-2">
                <Input
                  id="new-folder-name"
                  placeholder="Enter folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  disabled={isCreatingFolder || loadingState === 'loading' || loadingState === 'interacting'}
                />
                <Button type="submit" disabled={!newFolderName.trim() || isCreatingFolder}>
                  {isCreatingFolder ? <LoadingSpinner size={16} /> : <FolderPlus className="h-4 w-4" />}
                </Button>
              </div>
            </form>

            <Separator />

            {selectedFolderId && (
              <div className="space-y-2">
                <Label htmlFor="documents">Upload Documents to "{folders.find(f => f.id.toString() === selectedFolderId)?.name}"</Label>
                <Input
                  id="documents"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md"
                  onChange={handleFileChange}
                  disabled={!selectedFolderId || loadingState === 'loading' || loadingState === 'interacting'}
                />
                {selectedFiles.length > 0 && (
                  <ul className="text-xs text-muted-foreground list-disc list-inside">
                    {selectedFiles.map((file, index) => <li key={index}>{file.name}</li>)}
                  </ul>
                )}
              </div>
            )}

            {loadingState !== 'idle' && loadingState !== 'success' && (
              <LoadingSpinner message={loadingMessage} />
            )}
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleStartLearning}
              disabled={!selectedFolderId || selectedFiles.length === 0 || loadingState === 'loading' || loadingState === 'interacting'}
              className="w-full"
            >
              {loadingState === 'loading' || loadingState === 'interacting' ? 'Processing...' : 'Upload & Start Learning'}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
