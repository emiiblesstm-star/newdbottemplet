import React, { useEffect, useRef, useState } from 'react';
import {
    clearAuthMode,
    detectAuthModeFromCallback,
    exchangeCodeForToken,
    parseLegacyCallbackParams,
    persistAuthMode,
    setLegacyActiveAccount,
    storeLegacyAccounts,
    validateCSRFToken,
    clearCSRFToken,
} from '@/core/deriv/auth';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { api_base } from '@/external/bot-skeleton';

const CallbackPage: React.FC = () => {
    const processed = useRef(false);
    const [status, setStatus] = useState<'processing' | 'error' | 'done'>('processing');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;

        void handleCallback();
    }, []); // run once on mount

    const handleCallback = async () => {
        const url = new URL(window.location.href);
        const params = url.searchParams;

        // ── Detect auth mode from callback URL shape ─────────────────────────
        const mode = detectAuthModeFromCallback(url);

        if (!mode) {
            // Not a callback at all — redirect home
            window.location.replace('/');
            return;
        }

        if (mode === 'legacy') {
            await handleLegacyCallback(params);
        } else {
            await handleNewCallback(params);
        }
    };

    // ── Legacy: acct1/token1/cur1 … ─────────────────────────────────────────
    const handleLegacyCallback = async (params: URLSearchParams) => {
        try {
            const accounts = parseLegacyCallbackParams(params);
            if (!accounts.length) {
                setErrorMsg('No accounts found in legacy callback');
                setStatus('error');
                return;
            }

            storeLegacyAccounts(accounts);
            const first = accounts[0];
            setLegacyActiveAccount(first.loginid, first.token);
            localStorage.setItem('account_type', first.is_virtual ? 'demo' : 'real');

            persistAuthMode('legacy');

            // Initialize WebSocket with the legacy token
            await api_base.init(true);

            setStatus('done');
            window.location.replace(`/?account=${first.currency}`);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Legacy callback failed');
            setStatus('error');
        }
    };

    // ── New PKCE: ?code=...&state=... ────────────────────────────────────────
    const handleNewCallback = async (params: URLSearchParams) => {
        try {
            const code = params.get('code');
            const state = params.get('state');
            const error = params.get('error');

            if (error) {
                setErrorMsg(params.get('error_description') ?? error);
                setStatus('error');
                return;
            }

            if (!state || !validateCSRFToken(state)) {
                clearAuthMode();
                setErrorMsg('CSRF validation failed — possible security issue. Please try logging in again.');
                setStatus('error');
                return;
            }
            clearCSRFToken();

            if (!code) {
                setErrorMsg('Missing authorization code');
                setStatus('error');
                return;
            }

            const redirectUri = `${window.location.protocol}//${window.location.host}/callback`;
            const tokenResult = await exchangeCodeForToken(code, redirectUri);

            if (tokenResult.error) {
                setErrorMsg(tokenResult.error_description ?? tokenResult.error);
                setStatus('error');
                return;
            }

            // Fetch accounts and initialize WebSocket
            const accessToken = tokenResult.access_token!;
            const accounts = await DerivWSAccountsService.fetchAccountsList(accessToken);

            if (!accounts?.length) {
                setErrorMsg('No accounts returned after authentication');
                setStatus('error');
                return;
            }

            DerivWSAccountsService.storeAccounts(accounts);

            // Populate legacy localStorage maps so existing UI keeps working
            const accountsListMap: Record<string, string> = {};
            const clientAccountsMap: Record<string, unknown> = {};
            for (const acct of accounts) {
                accountsListMap[acct.account_id] = accessToken;
                clientAccountsMap[acct.account_id] = {
                    currency: acct.currency ?? 'USD',
                    is_virtual: acct.account_type === 'demo' ? 1 : 0,
                    balance: Number(acct.balance ?? 0),
                    token: accessToken,
                };
            }
            localStorage.setItem('accountsList', JSON.stringify(accountsListMap));
            localStorage.setItem('clientAccounts', JSON.stringify(clientAccountsMap));

            const first = accounts[0];
            localStorage.setItem('active_loginid', first.account_id);
            localStorage.setItem('account_type', first.account_type === 'demo' ? 'demo' : 'real');

            persistAuthMode('new');

            await api_base.init(true);
            if (!api_base.is_authorized) {
                await api_base.authorizeAndSubscribe();
            }

            setStatus('done');
            window.location.replace('/');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Authentication failed');
            setStatus('error');
        }
    };

    if (status === 'processing') {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <p>Completing sign in…</p>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    gap: '1rem',
                }}
            >
                <p style={{ color: 'red' }}>Sign in failed: {errorMsg}</p>
                <button onClick={() => window.location.replace('/')}>Return to Bot</button>
            </div>
        );
    }

    return null;
};

export default CallbackPage;
