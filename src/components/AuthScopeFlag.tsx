'use client';

import * as React from 'react';

/** Mini-Flag: markiert Body als Auth-Scope (nur in (public)/(auth)-Layout benutzen) */
export default function AuthScopeFlag() {
  React.useEffect(() => {
    document.body.dataset.scope = 'auth';
    return () => { delete document.body.dataset.scope; };
  }, []);
  return null;
}
