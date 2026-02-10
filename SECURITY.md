# Security Considerations

## Overview
This document outlines security considerations for the CloudFlare FPC Worker implementation.

## Configuration Security

### Environment Variables
- **NEVER** commit API credentials directly to the codebase
- Always use CloudFlare Worker environment variables with the `ENV_` prefix for sensitive data
- Example: Set `ENV_CLOUDFLARE_API_KEY` in CloudFlare dashboard, not in code

### KV Storage
- KV bindings must be properly configured in CloudFlare dashboard
- Variable name must be `KV` as specified in the code
- Ensure proper access controls are configured for KV namespaces

### R2 Storage  
- R2 storage contains cached content and should have appropriate access controls
- Only available in Ultra version
- Properly secure R2 bucket permissions

## Known Limitations

### Dynamic Configuration (FPC.js lines 1602-1608)
The JSON configuration system uses dynamic property assignment:
```javascript
this[key] = value;
```
**Risk**: If JSON_CONFIG is compromised, arbitrary properties could be set on the global scope.

**Mitigation**: 
- Only use trusted sources for ENV_JSON_CONFIG
- Validate configuration sources
- Consider implementing a whitelist of allowed configuration keys

### Cookie Bypass
Cookies listed in `DEFAULT_BYPASS_COOKIES` will bypass the cache:
- `admin` - prevents caching for admin users

**Important**: Ensure session cookies are properly secured with:
- `HttpOnly` flag
- `Secure` flag (HTTPS only)
- `SameSite` attribute

### ESI (Edge Side Includes)
ESI tags fetch external content and inject it into pages:
```html
<esi:include src="https://example.com/fragment" ttl="3600"/>
```

**Security Considerations**:
- Only include ESI fragments from trusted domains
- ESI requests are made server-side and can access internal resources
- Failed ESI requests are replaced with HTML comments (may leak information)
- Consider implementing a whitelist of allowed ESI domains

## Best Practices

### Cache Poisoning Prevention
- Query parameters are filtered (see `FILTER_GET` array)
- Cache keys include cookie variations for personalization
- Validate all user input before using in cache keys

### Content Security
- Review `CACHE_HEADERS` to ensure sensitive headers are not cached
- `CSPRO_HEADER` (Content-Security-Policy-Report-Only) is removed by default
- Ensure proper CORS configuration in worker settings

### API Rate Limiting
- Worker has CPU time limits (50ms per request with paid plan)
- KV has operation limits (10M reads, 1M writes per month)
- Monitor usage to prevent service disruption

### Dependency Security
Run `npm audit` regularly to check for vulnerabilities:
```bash
npm audit
npm audit fix
```

Note: The current `package-lock.json` shows 12 vulnerabilities that should be reviewed.

## Reporting Security Issues
If you discover a security vulnerability, please email: egorshitikov@gmail.com

Do not create public GitHub issues for security vulnerabilities.

## Regular Security Tasks

1. **Monthly**: Review and update dependencies
2. **Quarterly**: Review access logs for suspicious activity
3. **Before deployment**: Review all environment variables and configurations
4. **After incidents**: Update this document with lessons learned

## Additional Resources
- [CloudFlare Workers Security Best Practices](https://developers.cloudflare.com/workers/platform/security)
- [OWASP Caching Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Caching_Cheat_Sheet.html)
