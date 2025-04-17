import React, { useState, useEffect } from 'react';
import { FileUp, File, DownloadCloud, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { Resume } from '@/hooks/resume/useResume';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ResumeUploadSectionProps {
  resumeFile: File | null;
  setResumeFile: (file: File | null) => void;
  resume: Resume | null;
  loading: boolean;
  uploading: boolean;
  isAnalyzing: boolean;
  handleUpload: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDownload: () => void;
  pdfDataUrl: string | null;
}

const ResumeUploadSection: React.FC<ResumeUploadSectionProps> = ({
  resumeFile,
  setResumeFile,
  resume,
  loading,
  uploading,
  isAnalyzing,
  handleUpload,
  handleDelete,
  handleFileChange,
  handleDownload,
  pdfDataUrl,
}) => {
  // State to track file errors
  const [fileError, setFileError] = useState<string | null>(null);

  // Clear file error when a new file is selected
  useEffect(() => {
    if (resumeFile) {
      setFileError(null);
    }
  }, [resumeFile]);
  
  // Track whether we've already handled this file
  const [handledFileRef, setHandledFileRef] = useState<string | null>(null);
  
  // Automatically trigger upload when a file is selected
  useEffect(() => {
    if (resumeFile && !uploading && !isAnalyzing) {
      // Generate a unique reference for this file
      const fileRef = `${resumeFile.name}-${resumeFile.size}-${resumeFile.lastModified}`;
      
      // Only upload if we haven't handled this exact file already
      if (fileRef !== handledFileRef) {
        setHandledFileRef(fileRef);
        handleUpload();
      }
    }
  }, [resumeFile, uploading, isAnalyzing, handleUpload, handledFileRef]);

  // Display file preview based on file type
  const renderFilePreview = () => {
    // For PDF files
    if (resume?.file_url) {
      try {
        // If we have a stored resume with a URL
        return (
          <iframe 
            src={`${resume.file_url}#toolbar=0&navpanes=0`}
            className="w-full aspect-[8.5/11] border rounded-md"
            title="Resume preview"
            onError={() => setFileError("Could not load resume preview. The file may be inaccessible.")}
          />
        );
      } catch (error) {
        console.error("Error rendering resume preview:", error);
        return (
          <div className="w-full aspect-[8.5/11] border rounded-md flex flex-col items-center justify-center bg-red-50">
            <AlertCircle className="h-12 w-12 text-red-500 mb-2" />
            <p className="text-red-500">Error loading preview</p>
          </div>
        );
      }
    }
    
    // For local preview of newly selected files
    if (pdfDataUrl) {
      // Check if it's a PDF
      if (resumeFile?.type === 'application/pdf') {
        return (
          <iframe 
            src={pdfDataUrl}
            className="w-full aspect-[8.5/11] border rounded-md"
            title="Resume preview"
            onError={() => setFileError("Could not load PDF preview")}
          />
        );
      }
      
      // For DOCX, we can't preview directly, show a placeholder
      if (resumeFile?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return (
          <div className="w-full aspect-[8.5/11] border rounded-md flex flex-col items-center justify-center bg-accent/10">
            <File className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Word Document Preview</p>
            <p className="text-xs text-muted-foreground mt-1">(Preview not available for DOCX files)</p>
          </div>
        );
      }
    }
    
    // If no file uploaded yet
    return (
      <div className="bg-accent/10 aspect-[8.5/11] flex items-center justify-center rounded-md">
        <p className="text-muted-foreground">No file uploaded</p>
      </div>
    );
  };

  // Get status message
  const getStatusMessage = () => {
    if (uploading) return "Uploading...";
    if (isAnalyzing) return "Analyzing...";
    return null;
  };

  const statusMessage = getStatusMessage();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Your Resume</CardTitle>
        <CardDescription>
          Upload your resume in PDF or Word (DOCX) format to receive personalized feedback and insights.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fileError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {fileError}
            </AlertDescription>
          </Alert>
        )}
        
        {statusMessage && (
          <Alert className="mb-4 bg-primary/10 border-primary">
            <div className="flex items-center space-x-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
              <AlertDescription>
                {statusMessage}
              </AlertDescription>
            </div>
          </Alert>
        )}
      
        {loading && !uploading && !isAnalyzing ? (
          <div className="border-2 border-dashed border-muted-foreground/20 rounded-md p-10 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your resume...</p>
          </div>
        ) : !resume && !resumeFile ? (
          <div className="border-2 border-dashed border-muted-foreground/20 rounded-md p-10 text-center">
            <FileUp className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Drag and drop your resume here, or click to browse</p>
            <input 
              type="file" 
              accept=".pdf,.docx" 
              id="resume-upload" 
              className="hidden" 
              onChange={handleFileChange}
            />
            <Button asChild>
              <label htmlFor="resume-upload">Browse Files</label>
            </Button>
          </div>
        ) : (
          <div className="border rounded-md p-4">
            <div className="flex items-center space-x-3">
              <File className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <p className="font-medium">
                  {resumeFile ? resumeFile.name : (resume?.file_name || resume?.file_path?.split('/').pop())}
                </p>
                <p className="text-sm text-muted-foreground">
                  {resumeFile 
                    ? `${(resumeFile.size / 1024 / 1024).toFixed(2)} MB`
                    : `Uploaded on ${new Date(resume?.uploaded_at || resume?.created_at || '').toLocaleDateString()}`
                  }
                </p>
              </div>
              <div className="flex gap-2">
                {resume && resume.file_url && (
                  <Button variant="outline" size="icon" onClick={handleDownload} disabled={uploading || isAnalyzing}>
                    <DownloadCloud className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" size="icon" onClick={handleDelete} disabled={uploading || isAnalyzing}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Resume preview
              </p>
              
              {renderFilePreview()}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        {!resumeFile && resume && !uploading && !isAnalyzing && (
          <div className="w-full flex justify-between">
            <Button variant="outline" onClick={handleDelete}>
              Delete Resume
            </Button>
            <input 
              type="file" 
              accept=".pdf,.docx" 
              id="resume-replace" 
              className="hidden" 
              onChange={handleFileChange}
            />
            <Button asChild>
              <label htmlFor="resume-replace">Replace Resume</label>
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default ResumeUploadSection;

// import React, { useState, useEffect } from 'react';
// import { FileUp, File, DownloadCloud, Trash2, AlertCircle } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
// import { useToast } from '@/hooks/use-toast';
// import type { Resume } from '@/hooks/resume/useResume';
// import { Alert, AlertDescription } from '@/components/ui/alert';

// interface ResumeUploadSectionProps {
//   resumeFile: File | null;
//   setResumeFile: (file: File | null) => void;
//   resume: Resume | null;
//   loading: boolean;
//   uploading: boolean;
//   isAnalyzing: boolean;
//   handleUpload: () => Promise<void>;
//   handleDelete: () => Promise<void>;
//   handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
//   handleDownload: () => void;
//   pdfDataUrl: string | null;
// }

// const ResumeUploadSection: React.FC<ResumeUploadSectionProps> = ({
//   resumeFile,
//   setResumeFile,
//   resume,
//   loading,
//   uploading,
//   isAnalyzing,
//   handleUpload,
//   handleDelete,
//   handleFileChange,
//   handleDownload,
//   pdfDataUrl,
// }) => {
//   // State to track file errors
//   const [fileError, setFileError] = useState<string | null>(null);

//   // Clear file error when a new file is selected
//   useEffect(() => {
//     if (resumeFile) {
//       setFileError(null);
//     }
//   }, [resumeFile]);
  
//   // Automatically trigger upload when a file is selected
//   useEffect(() => {
//     if (resumeFile && !uploading && !isAnalyzing) {
//       handleUpload();
//     }
//   }, [resumeFile, uploading, isAnalyzing, handleUpload]);

//   // Display file preview based on file type
//   const renderFilePreview = () => {
//     // For PDF files
//     if (resume?.file_url) {
//       try {
//         // If we have a stored resume with a URL
//         return (
//           <iframe 
//             src={`${resume.file_url}#toolbar=0&navpanes=0`}
//             className="w-full aspect-[8.5/11] border rounded-md"
//             title="Resume preview"
//             onError={() => setFileError("Could not load resume preview. The file may be inaccessible.")}
//           />
//         );
//       } catch (error) {
//         console.error("Error rendering resume preview:", error);
//         return (
//           <div className="w-full aspect-[8.5/11] border rounded-md flex flex-col items-center justify-center bg-red-50">
//             <AlertCircle className="h-12 w-12 text-red-500 mb-2" />
//             <p className="text-red-500">Error loading preview</p>
//           </div>
//         );
//       }
//     }
    
//     // For local preview of newly selected files
//     if (pdfDataUrl) {
//       // Check if it's a PDF
//       if (resumeFile?.type === 'application/pdf') {
//         return (
//           <iframe 
//             src={pdfDataUrl}
//             className="w-full aspect-[8.5/11] border rounded-md"
//             title="Resume preview"
//             onError={() => setFileError("Could not load PDF preview")}
//           />
//         );
//       }
      
//       // For DOCX, we can't preview directly, show a placeholder
//       if (resumeFile?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
//         return (
//           <div className="w-full aspect-[8.5/11] border rounded-md flex flex-col items-center justify-center bg-accent/10">
//             <File className="h-12 w-12 text-muted-foreground mb-2" />
//             <p className="text-muted-foreground">Word Document Preview</p>
//             <p className="text-xs text-muted-foreground mt-1">(Preview not available for DOCX files)</p>
//           </div>
//         );
//       }
//     }
    
//     // If no file uploaded yet
//     return (
//       <div className="bg-accent/10 aspect-[8.5/11] flex items-center justify-center rounded-md">
//         <p className="text-muted-foreground">No file uploaded</p>
//       </div>
//     );
//   };

//   // Get status message
//   const getStatusMessage = () => {
//     if (uploading) return "Uploading...";
//     if (isAnalyzing) return "Analyzing...";
//     return null;
//   };

//   const statusMessage = getStatusMessage();

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>Upload Your Resume</CardTitle>
//         <CardDescription>
//           Upload your resume in PDF or Word (DOCX) format to receive personalized feedback and insights.
//         </CardDescription>
//       </CardHeader>
//       <CardContent className="space-y-4">
//         {fileError && (
//           <Alert variant="destructive" className="mb-4">
//             <AlertCircle className="h-4 w-4" />
//             <AlertDescription>
//               {fileError}
//             </AlertDescription>
//           </Alert>
//         )}
        
//         {statusMessage && (
//           <Alert className="mb-4 bg-primary/10 border-primary">
//             <div className="flex items-center space-x-2">
//               <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
//               <AlertDescription>
//                 {statusMessage}
//               </AlertDescription>
//             </div>
//           </Alert>
//         )}
      
//         {loading && !uploading && !isAnalyzing ? (
//           <div className="border-2 border-dashed border-muted-foreground/20 rounded-md p-10 text-center">
//             <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
//             <p className="text-muted-foreground">Loading your resume...</p>
//           </div>
//         ) : !resume && !resumeFile ? (
//           <div className="border-2 border-dashed border-muted-foreground/20 rounded-md p-10 text-center">
//             <FileUp className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
//             <p className="text-muted-foreground mb-4">Drag and drop your resume here, or click to browse</p>
//             <input 
//               type="file" 
//               accept=".pdf,.docx" 
//               id="resume-upload" 
//               className="hidden" 
//               onChange={handleFileChange}
//             />
//             <Button asChild>
//               <label htmlFor="resume-upload">Browse Files</label>
//             </Button>
//           </div>
//         ) : (
//           <div className="border rounded-md p-4">
//             <div className="flex items-center space-x-3">
//               <File className="h-8 w-8 text-primary" />
//               <div className="flex-1">
//                 <p className="font-medium">
//                   {resumeFile ? resumeFile.name : (resume?.file_name || resume?.file_path?.split('/').pop())}
//                 </p>
//                 <p className="text-sm text-muted-foreground">
//                   {resumeFile 
//                     ? `${(resumeFile.size / 1024 / 1024).toFixed(2)} MB`
//                     : `Uploaded on ${new Date(resume?.uploaded_at || resume?.created_at || '').toLocaleDateString()}`
//                   }
//                 </p>
//               </div>
//               <div className="flex gap-2">
//                 {resume && resume.file_url && (
//                   <Button variant="outline" size="icon" onClick={handleDownload} disabled={uploading || isAnalyzing}>
//                     <DownloadCloud className="h-4 w-4" />
//                   </Button>
//                 )}
//                 <Button variant="outline" size="icon" onClick={handleDelete} disabled={uploading || isAnalyzing}>
//                   <Trash2 className="h-4 w-4" />
//                 </Button>
//               </div>
//             </div>
            
//             <div className="mt-4 pt-4 border-t">
//               <p className="text-sm text-muted-foreground mb-2">
//                 Resume preview
//               </p>
              
//               {renderFilePreview()}
//             </div>
//           </div>
//         )}
//       </CardContent>
//       <CardFooter>
//         {!resumeFile && resume && !uploading && !isAnalyzing && (
//           <div className="w-full flex justify-between">
//             <Button variant="outline" onClick={handleDelete}>
//               Delete Resume
//             </Button>
//             <input 
//               type="file" 
//               accept=".pdf,.docx" 
//               id="resume-replace" 
//               className="hidden" 
//               onChange={handleFileChange}
//             />
//             <Button asChild>
//               <label htmlFor="resume-replace">Replace Resume</label>
//             </Button>
//           </div>
//         )}
//       </CardFooter>
//     </Card>
//   );
// };

// export default ResumeUploadSection;




// import React, { useState, useEffect } from 'react';
// import { FileUp, File, DownloadCloud, Trash2, AlertCircle } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
// import { useToast } from '@/hooks/use-toast';
// import type { Resume } from '@/hooks/resume/useResume';
// import { Alert, AlertDescription } from '@/components/ui/alert';

// interface ResumeUploadSectionProps {
//   resumeFile: File | null;
//   setResumeFile: (file: File | null) => void;
//   resume: Resume | null;
//   loading: boolean;
//   uploading: boolean;
//   isAnalyzing: boolean;
//   handleUpload: () => Promise<void>;
//   handleDelete: () => Promise<void>;
//   handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
//   handleDownload: () => void;
//   pdfDataUrl: string | null;
// }

// const ResumeUploadSection: React.FC<ResumeUploadSectionProps> = ({
//   resumeFile,
//   setResumeFile,
//   resume,
//   loading,
//   uploading,
//   isAnalyzing,
//   handleUpload,
//   handleDelete,
//   handleFileChange,
//   handleDownload,
//   pdfDataUrl,
// }) => {
//   // State to track file errors
//   const [fileError, setFileError] = useState<string | null>(null);

//   // Clear file error when a new file is selected
//   useEffect(() => {
//     if (resumeFile) {
//       setFileError(null);
//     }
//   }, [resumeFile]);

//   // Display file preview based on file type
//   const renderFilePreview = () => {
//     // For PDF files
//     if (resume?.file_url) {
//       try {
//         // If we have a stored resume with a URL
//         return (
//           <iframe 
//             src={`${resume.file_url}#toolbar=0&navpanes=0`}
//             className="w-full aspect-[8.5/11] border rounded-md"
//             title="Resume preview"
//             onError={() => setFileError("Could not load resume preview. The file may be inaccessible.")}
//           />
//         );
//       } catch (error) {
//         console.error("Error rendering resume preview:", error);
//         return (
//           <div className="w-full aspect-[8.5/11] border rounded-md flex flex-col items-center justify-center bg-red-50">
//             <AlertCircle className="h-12 w-12 text-red-500 mb-2" />
//             <p className="text-red-500">Error loading preview</p>
//           </div>
//         );
//       }
//     }
    
//     // For local preview of newly selected files
//     if (pdfDataUrl) {
//       // Check if it's a PDF
//       if (resumeFile?.type === 'application/pdf') {
//         return (
//           <iframe 
//             src={pdfDataUrl}
//             className="w-full aspect-[8.5/11] border rounded-md"
//             title="Resume preview"
//             onError={() => setFileError("Could not load PDF preview")}
//           />
//         );
//       }
      
//       // For DOCX, we can't preview directly, show a placeholder
//       if (resumeFile?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
//         return (
//           <div className="w-full aspect-[8.5/11] border rounded-md flex flex-col items-center justify-center bg-accent/10">
//             <File className="h-12 w-12 text-muted-foreground mb-2" />
//             <p className="text-muted-foreground">Word Document Preview</p>
//             <p className="text-xs text-muted-foreground mt-1">(Preview not available for DOCX files)</p>
//           </div>
//         );
//       }
//     }
    
//     // If no file uploaded yet
//     return (
//       <div className="bg-accent/10 aspect-[8.5/11] flex items-center justify-center rounded-md">
//         <p className="text-muted-foreground">No file uploaded</p>
//       </div>
//     );
//   };

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>Upload Your Resume</CardTitle>
//         <CardDescription>
//           Upload your resume in PDF or Word (DOCX) format to receive personalized feedback and insights.
//         </CardDescription>
//       </CardHeader>
//       <CardContent className="space-y-4">
//         {fileError && (
//           <Alert variant="destructive" className="mb-4">
//             <AlertCircle className="h-4 w-4" />
//             <AlertDescription>
//               {fileError}
//             </AlertDescription>
//           </Alert>
//         )}
      
//         {loading ? (
//           <div className="border-2 border-dashed border-muted-foreground/20 rounded-md p-10 text-center">
//             <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
//             <p className="text-muted-foreground">Loading your resume...</p>
//           </div>
//         ) : !resume && !resumeFile ? (
//           <div className="border-2 border-dashed border-muted-foreground/20 rounded-md p-10 text-center">
//             <FileUp className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
//             <p className="text-muted-foreground mb-4">Drag and drop your resume here, or click to browse</p>
//             <input 
//               type="file" 
//               accept=".pdf,.docx" 
//               id="resume-upload" 
//               className="hidden" 
//               onChange={handleFileChange}
//             />
//             <Button asChild>
//               <label htmlFor="resume-upload">Browse Files</label>
//             </Button>
//           </div>
//         ) : (
//           <div className="border rounded-md p-4">
//             <div className="flex items-center space-x-3">
//               <File className="h-8 w-8 text-primary" />
//               <div className="flex-1">
//                 <p className="font-medium">
//                   {resumeFile ? resumeFile.name : (resume?.file_name || resume?.file_path?.split('/').pop())}
//                 </p>
//                 <p className="text-sm text-muted-foreground">
//                   {resumeFile 
//                     ? `${(resumeFile.size / 1024 / 1024).toFixed(2)} MB`
//                     : `Uploaded on ${new Date(resume?.uploaded_at || resume?.created_at || '').toLocaleDateString()}`
//                   }
//                 </p>
//               </div>
//               <div className="flex gap-2">
//                 {resume && resume.file_url && (
//                   <Button variant="outline" size="icon" onClick={handleDownload}>
//                     <DownloadCloud className="h-4 w-4" />
//                   </Button>
//                 )}
//                 <Button variant="outline" size="icon" onClick={handleDelete}>
//                   <Trash2 className="h-4 w-4" />
//                 </Button>
//               </div>
//             </div>
            
//             <div className="mt-4 pt-4 border-t">
//               <p className="text-sm text-muted-foreground mb-2">
//                 Resume preview
//               </p>
              
//               {renderFilePreview()}
//             </div>
//           </div>
//         )}
//       </CardContent>
//       <CardFooter>
//         {resumeFile && (
//           <Button 
//             onClick={handleUpload} 
//             disabled={!resumeFile || uploading || isAnalyzing} 
//             className="w-full"
//           >
//             {uploading || isAnalyzing ? 
//               (isAnalyzing ? 'Analyzing...' : 'Uploading...') : 
//               'Upload & Analyze Resume'}
//           </Button>
//         )}
        
//         {!resumeFile && resume && (
//           <div className="w-full flex justify-between">
//             <Button variant="outline" onClick={handleDelete}>
//               Delete Resume
//             </Button>
//             <input 
//               type="file" 
//               accept=".pdf,.docx" 
//               id="resume-replace" 
//               className="hidden" 
//               onChange={handleFileChange}
//             />
//             <Button asChild>
//               <label htmlFor="resume-replace">Replace Resume</label>
//             </Button>
//           </div>
//         )}
//       </CardFooter>
//     </Card>
//   );
// };

// export default ResumeUploadSection;
