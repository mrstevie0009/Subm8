'use client';

import * as React from 'react';

/** Mini-Flag: markiert Body als Auth-Scope (nur in (public)/(auth)-Layout benutzen) */
export default function AuthScopeFlag() {
  React.useEffect(() => {
    document.documentElement.dataset.scope = 'auth';
    document.body.dataset.scope = 'auth';

    return () => {
      delete document.documentElement.dataset.scope;
      delete document.body.dataset.scope;
    };
  }, []);
  return null;
}
