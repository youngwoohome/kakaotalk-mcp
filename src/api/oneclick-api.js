'use strict';

class OneClickApiClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://158.247.213.200:3000';
    this.sessionCookie = options.sessionCookie || '';
    this.extraHeaders = options.headers || {};
  }

  buildHeaders(includeJson = true) {
    const headers = {
      ...this.extraHeaders,
    };

    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.sessionCookie) {
      headers.Cookie = this.sessionCookie;
    }

    return headers;
  }

  async request(pathname, options = {}) {
    const url = new URL(pathname, this.baseUrl);
    const method = options.method || 'GET';
    const response = await fetch(url, {
      method,
      headers: this.buildHeaders(method !== 'GET'),
      body: method === 'GET' ? undefined : JSON.stringify(options.body || {}),
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const detail = typeof payload === 'string'
        ? payload.slice(0, 300)
        : JSON.stringify(payload).slice(0, 300);
      throw new Error(`${method} ${pathname} failed (${response.status}): ${detail}`);
    }

    return payload;
  }

  fetchSendList() {
    return this.request('/api/kakaotalk-send-list');
  }

  postHistory(payload) {
    return this.request('/api/kakaotalk-send-history', {
      method: 'POST',
      body: payload,
    });
  }

  disableOneTimeRow(payload) {
    return this.request('/api/kakaotalk-send-list/disable', {
      method: 'POST',
      body: payload,
    });
  }
}

module.exports = {
  OneClickApiClient,
};
