import http.server

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', 8080), NoCacheHandler)
    print('Serving on http://0.0.0.0:8080 with no-cache headers...')
    server.serve_forever()
