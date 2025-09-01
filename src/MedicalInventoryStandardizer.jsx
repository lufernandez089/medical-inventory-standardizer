import React, { useState, useEffect } from 'react';
import { Plus, Upload, Download, Check, X, Search, Edit2, Trash2, AlertCircle, Loader2 } from 'lucide-react';

const MedicalInventoryStandardizer = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('import');
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  useEffect(() => {
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-500 mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Medical Inventory Standardizer
          </h1>
          <p className="text-xl text-gray-600">
            Standardize your medical device inventory data
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Deployment Fixed - Full Functionality Restoration in Progress
            </h2>
            <p className="text-gray-600 mb-6">
              The deployment error has been resolved. The full medical inventory standardizer functionality is being restored.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="text-yellow-600" size={20} />
                <span className="font-medium text-yellow-800">Temporary Maintenance Mode</span>
              </div>
              <p className="text-yellow-700 text-sm">
                We're currently restoring the full functionality. This temporary version fixes the deployment error.
              </p>
            </div>
            <button
              onClick={() => showToast('Full functionality will be restored shortly!', 'info')}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all"
            >
              Check Status
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-6 right-6 px-6 py-4 rounded-2xl shadow-2xl text-white z-50 ${
          toast.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 
          toast.type === 'error' ? 'bg-gradient-to-r from-red-500 to-pink-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'
        }`}>
          <div className="flex items-center gap-3">
            {toast.type === 'success' && <Check size={20} />}
            {toast.type === 'error' && <X size={20} />}
            {toast.type === 'info' && <AlertCircle size={20} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalInventoryStandardizer;
