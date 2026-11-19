import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'একটি অপ্রত্যাশিত সমস্যা হয়েছে।',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'ডাটা লোড বা সংরক্ষণে সমস্যা হয়েছে। অনুগ্রহ করে পেজটি রিলোড করুন।';
      if (this.state.message.includes('Quota exceeded')) {
        friendly = 'আজকের Firestore ফ্রি কোটা শেষ হয়েছে। আগামীকাল আবার চালু হবে।';
      } else if (this.state.message.includes('permission')) {
        friendly = 'ফায়ারবেস পারমিশন এরর হয়েছে। আপনার জিমেইল অ্যাকাউন্ট দিয়ে পুনরায় লগইন করে চেষ্টা করুন।';
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-bold text-slate-900">দুঃখিত, একটি সমস্যা হয়েছে</h1>
            <p className="mt-2 text-sm text-slate-600">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              পেজ রিলোড করুন
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
