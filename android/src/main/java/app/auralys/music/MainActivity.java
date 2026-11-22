package app.auralys.music;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.text.InputType;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Auralys — pembungkus Android (WebView) untuk aplikasi web Auralys.
 * Aplikasi web membutuhkan backend Node (folder root repo ini) yang sudah di-deploy;
 * URL-nya dimasukkan saat pertama kali aplikasi dibuka dan bisa diubah lewat menu.
 */
public class MainActivity extends Activity {

    private static final String TAG = "Auralys";
    private static final String PREFS = "auralys";
    private static final String KEY_URL = "server_url";
    private static final int REQ_FILE = 1001;
    private static final int REQ_SETTINGS = 1002;

    private WebView web;
    private ProgressBar progress;
    private LinearLayout errorView;
    private TextView errorText;
    private ValueCallback<Uri[]> filePathCallback;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();

        String start = savedUrl();
        if (start == null || start.isEmpty()) {
            askForServerUrl(true);
        } else {
            load(start);
        }
    }

    /* ------------------------------------------------------------------ UI */

    private void buildUi() {
        FrameLayout root = new FrameLayout(this);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#f5f5f6"));
        root.addView(web, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgress(0);
        FrameLayout.LayoutParams pLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3));
        pLp.gravity = Gravity.TOP;
        root.addView(progress, pLp);

        errorView = new LinearLayout(this);
        errorView.setOrientation(LinearLayout.VERTICAL);
        errorView.setGravity(Gravity.CENTER);
        errorView.setBackgroundColor(Color.parseColor("#f5f5f6"));
        errorView.setPadding(dp(28), dp(28), dp(28), dp(28));
        errorView.setVisibility(View.GONE);

        TextView title = new TextView(this);
        title.setText("Tidak dapat terhubung");
        title.setTextSize(19);
        title.setTextColor(Color.parseColor("#101114"));
        title.setGravity(Gravity.CENTER);
        errorView.addView(title);

        errorText = new TextView(this);
        errorText.setTextSize(13);
        errorText.setTextColor(Color.parseColor("#5f6368"));
        errorText.setGravity(Gravity.CENTER);
        errorText.setPadding(0, dp(10), 0, dp(20));
        errorView.addView(errorText);

        Button retry = new Button(this);
        retry.setText("Coba lagi");
        retry.setOnClickListener(v -> load(currentUrl()));
        errorView.addView(retry);

        Button change = new Button(this);
        change.setText("Ubah alamat server");
        change.setOnClickListener(v -> askForServerUrl(true));
        errorView.addView(change);

        root.addView(errorView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(root);
        configureWebView();
    }

    private int dp(int v) {
        return Math.round(getResources().getDisplayMetrics().density * v);
    }

    private void configureWebView() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // WebView menambahkan "; wv" pada User-Agent; YouTube iframe lebih ramah
        // terhadap UA tanpa penanda wv.
        String ua = s.getUserAgentString();
        if (ua != null) s.setUserAgentString(ua.replace("; wv", "").replace(" Version/4.0", ""));

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                errorView.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError(String.valueOf(error.getDescription()));
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                showError(description);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
                progress.setProgress(newProgress);
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.d(TAG, cm.message() + " @" + cm.lineNumber());
                return true;
            }

            /* dialog JS (alert / confirm / prompt) */
            @Override
            public boolean onJsAlert(WebView view, String url, String message, final android.webkit.JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton(android.R.string.ok, (d, w) -> result.confirm())
                        .setOnCancelListener(d -> result.cancel())
                        .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final android.webkit.JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton(android.R.string.ok, (d, w) -> result.confirm())
                        .setNegativeButton(android.R.string.cancel, (d, w) -> result.cancel())
                        .setOnCancelListener(d -> result.cancel())
                        .show();
                return true;
            }

            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String defaultValue,
                                      final android.webkit.JsPromptResult result) {
                final EditText input = new EditText(MainActivity.this);
                input.setInputType(InputType.TYPE_CLASS_TEXT);
                input.setText(defaultValue == null ? "" : defaultValue);
                input.setSelection(input.getText().length());
                AlertDialog dlg = new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setView(input)
                        .setPositiveButton(android.R.string.ok, (d, w) -> result.confirm(input.getText().toString()))
                        .setNegativeButton(android.R.string.cancel, (d, w) -> result.cancel())
                        .setOnCancelListener(d -> result.cancel())
                        .create();
                dlg.show();
                return true;
            }

            /* unggah/impor berkas (dipakai fitur "Impor dari file") */
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    startActivityForResult(Intent.createChooser(i, "Pilih berkas"), REQ_FILE);
                    return true;
                } catch (ActivityNotFoundException e) {
                    filePathCallback = null;
                    return false;
                }
            }

            /* video layar penuh */
            @Override
            public void onShowCustomView(View view, WebChromeClient.CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customViewCallback = callback;
                FrameLayout root = (FrameLayout) web.getParent();
                customView.setBackgroundColor(Color.BLACK);
                root.addView(customView, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
            }

            @Override
            public void onHideCustomView() {
                FrameLayout root = (FrameLayout) web.getParent();
                if (customView != null) root.removeView(customView);
                customView = null;
                web.setVisibility(View.VISIBLE);
                if (customViewCallback != null) customViewCallback.onCustomViewHidden();
                customViewCallback = null;
            }
        });
    }

    /* ------------------------------------------------------------- navigasi */

    private boolean handleUrl(Uri uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        String host = uri.getHost() == null ? "" : uri.getHost();
        String baseHost = Uri.parse(currentUrl()).getHost();

        if (scheme.startsWith("http") && host.equals(baseHost)) return false; // tetap di dalam app

        // tautan eksternal (YouTube Music, YouTube, dll) dibuka di browser
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception e) {
            Toast.makeText(this, "Tidak ada aplikasi untuk membuka tautan", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            web.getWebChromeClient().onHideCustomView();
            return;
        }
        // beri kesempatan aplikasi web menutup pemutar/sheet/menu lebih dulu
        web.evaluateJavascript(
                "(function(){try{return !!(window.AURALYS&&window.AURALYS.back&&window.AURALYS.back())}catch(e){return false}})()",
                value -> {
                    boolean handled = value != null && value.contains("true");
                    if (handled) return;
                    if (web.canGoBack()) web.goBack();
                    else finish();
                });
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getData() != null) results = new Uri[]{data.getData()};
                else if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    results = new Uri[n];
                    for (int i = 0; i < n; i++) results[i] = data.getClipData().getItemAt(i).getUri();
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            askForServerUrl(false);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    /* ---------------------------------------------------------------- muat */

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    private String savedUrl() {
        return prefs().getString(KEY_URL, getString(R.string.server_url));
    }

    private String currentUrl() {
        String u = savedUrl();
        return u == null ? "" : u;
    }

    private void load(String url) {
        if (url == null || url.trim().isEmpty()) {
            askForServerUrl(true);
            return;
        }
        String fixed = normalize(url);
        prefs().edit().putString(KEY_URL, fixed).apply();
        errorView.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
        progress.setVisibility(View.VISIBLE);
        web.loadUrl(fixed);
    }

    private String normalize(String raw) {
        String u = raw.trim();
        if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://" + u;
        if (u.endsWith("/")) u = u.substring(0, u.length() - 1);
        return u;
    }

    private void showError(String message) {
        progress.setVisibility(View.GONE);
        web.setVisibility(View.GONE);
        errorView.setVisibility(View.VISIBLE);
        errorText.setText((message == null ? "" : message) + "\n\nAlamat server: " + currentUrl()
                + "\n\nPastikan server Auralys sudah online, lalu coba lagi.");
    }

    private void askForServerUrl(boolean firstRun) {
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        input.setHint("https://auralys.up.railway.app");
        String current = savedUrl();
        if (current != null && !current.isEmpty()) input.setText(current);

        AlertDialog.Builder b = new AlertDialog.Builder(this)
                .setTitle(firstRun ? "Hubungkan ke server Auralys" : "Alamat server")
                .setMessage("Masukkan alamat aplikasi Auralys yang sudah kamu deploy "
                        + "(Railway / Render / Vercel / VPS).")
                .setView(input)
                .setPositiveButton("Simpan", (d, w) -> {
                    String v = input.getText().toString().trim();
                    if (v.isEmpty()) {
                        Toast.makeText(this, "Alamat tidak boleh kosong", Toast.LENGTH_SHORT).show();
                        askForServerUrl(firstRun);
                        return;
                    }
                    load(v);
                })
                .setNegativeButton(firstRun ? "Keluar" : "Batal", (d, w) -> {
                    if (firstRun) {
                        Toast.makeText(this, "Buka lagi kapan saja untuk mengisi alamat server",
                                Toast.LENGTH_LONG).show();
                        finish();
                    }
                });
        if (!firstRun) b.setNeutralButton("Buka ulang", (d, w) -> load(currentUrl()));
        b.show();
    }

    /* --------------------------------------------------------------- bridge */

    private class Bridge {
        @JavascriptInterface
        public String getVersion() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "1.0";
            }
        }

        @JavascriptInterface
        public String getServerUrl() {
            return currentUrl();
        }

        @JavascriptInterface
        public void openSettings() {
            runOnUiThread(() -> askForServerUrl(false));
        }

        /** Dipakai tombol "Ekspor data" agar berkas benar-benar tersimpan di Downloads. */
        @JavascriptInterface
        public void saveFile(String name, String content) {
            try {
                String mime = "application/json";
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    ContentResolver resolver = getContentResolver();
                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) throw new IllegalStateException("MediaStore menolak");
                    try (OutputStream out = resolver.openOutputStream(uri)) {
                        out.write(content.getBytes("UTF-8"));
                    }
                } else {
                    File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!dir.exists()) dir.mkdirs();
                    File f = new File(dir, name);
                    try (FileOutputStream out = new FileOutputStream(f)) {
                        out.write(content.getBytes("UTF-8"));
                    }
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "Tersimpan di folder Downloads", Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                Log.e(TAG, "saveFile gagal", e);
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "Gagal menyimpan berkas", Toast.LENGTH_SHORT).show());
            }
        }
    }
}
