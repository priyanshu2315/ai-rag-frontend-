import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDropzone } from 'react-dropzone';
import { FileText, UploadCloud, LogOut, Database } from 'lucide-react';
import { RootState } from '../store/store';
import { logout } from '../store/slices/authSlice';
import { setDocuments, addDocument, setActiveDocumentId, setLoading, setError } from '../store/slices/documentSlice';
import { documentApi } from '../api';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';

const Sidebar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { documents, activeDocumentId, loading } = useSelector((state: RootState) => state.document);

  const fetchDocuments = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      const res = await documentApi.getMyDocuments();
      dispatch(setDocuments(res.data.data));
    } catch (err: any) {
      dispatch(setError(err.message));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    try {
      const res = await documentApi.upload(file);
      dispatch(addDocument(res.data.data));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Upload failed');
    }
  }, [dispatch]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: false
  });

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="w-80 h-screen bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center space-x-2">
        <Database className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI RAG</h1>
      </div>

      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div 
          {...getRootProps()} 
          className={clsx(
            "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors flex flex-col items-center space-y-2",
            isDragActive 
              ? "border-primary bg-primary/5" 
              : "border-gray-300 dark:border-gray-700 hover:border-primary hover:bg-gray-100 dark:hover:bg-gray-800"
          )}
        >
          <input {...getInputProps()} />
          <UploadCloud className={clsx("w-8 h-8", isDragActive ? "text-primary" : "text-gray-400")} />
          <div className="text-sm">
            <span className="font-semibold text-primary">Click to upload</span> or drag and drop
          </div>
          <div className="text-xs text-gray-500">PDF, DOCX, TXT</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Documents</h2>
        
        <button
          onClick={() => dispatch(setActiveDocumentId(null))}
          className={clsx(
            "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
            activeDocumentId === null 
              ? "bg-primary text-white" 
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
          )}
        >
          <Database className="w-4 h-4" />
          <span className="truncate flex-1">Search All Documents</span>
        </button>

        {loading && (!documents || documents.length === 0) ? (
          <div className="text-center text-sm text-gray-500 py-4">Loading...</div>
        ) : (
          (documents || []).map(doc => (
            <button
              key={doc.id}
              onClick={() => dispatch(setActiveDocumentId(doc.id))}
              className={clsx(
                "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                activeDocumentId === doc.id 
                  ? "bg-primary text-white" 
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
              )}
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span className="truncate flex-1" title={doc.filename}>{doc.filename}</span>
            </button>
          ))
        )}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
