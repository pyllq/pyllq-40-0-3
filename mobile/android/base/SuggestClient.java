/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;

import org.json.JSONArray;
import org.mozilla.gecko.mozglue.RobocopTarget;
import org.mozilla.gecko.util.HardwareUtils;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.text.TextUtils;
import android.support.v4.util.LruCache;
import android.util.Log;

import org.mozilla.gecko.home.SearchEngine;

/**
 * Use network-based search suggestions.
 */
public class SuggestClient {
    private static final String LOGTAG = "GeckoSuggestClient";

    // This should go through GeckoInterface to get the UA, but the search activity
    // doesn't use a GeckoView yet. Until it does, get the UA directly.
    private static final String USER_AGENT = HardwareUtils.isTablet() ?
        AppConstants.USER_AGENT_FENNEC_TABLET : AppConstants.USER_AGENT_FENNEC_MOBILE;

    private final Context mContext;
    private final int mTimeout;

    // should contain the string "__searchTerms__", which is replaced with the query
    private final String mSuggestTemplate;

    // the maximum number of suggestions to return
    private final int mMaxResults;

    // used by robocop for testing
    private final boolean mCheckNetwork;

    // used to make suggestions appear instantly after opt-in
    //private String mPrevQuery;
    //private ArrayList<String> mPrevResults;
    private LruCache<String, ArrayList<String> > mSuggestionsCache;

    //public SearchEngine mSearchEngine;

    @RobocopTarget
    public SuggestClient(Context context, String suggestTemplate, int timeout, int maxResults, boolean checkNetwork) {
        mContext = context;
        //mSearchEngine = searchEngine;
        mMaxResults = maxResults;
        mSuggestTemplate = suggestTemplate;
        mTimeout = timeout;
        mCheckNetwork = checkNetwork;
        mSuggestionsCache = new LruCache<String, ArrayList<String> >(256);
    }

    //public SuggestClient(Context context, SearchEngine searchEngine, String suggestTemplate, int timeout) {
    public SuggestClient(Context context, String suggestTemplate, int timeout) {
        this(context, suggestTemplate, timeout, Integer.MAX_VALUE, true);
    }

    /**
     * Queries for a given search term and returns an ArrayList of suggestions.
     */
    public ArrayList<String> query(String query) {
        //if (query.equals(mPrevQuery))
        //    return mPrevResults;

        ArrayList<String> suggestions = null;
        if (query != null) {
            suggestions = mSuggestionsCache.get(query);
            if (suggestions != null)
                return suggestions;
        }

        suggestions = new ArrayList<String>();

        if (query == null)
            return suggestions;

        if (TextUtils.isEmpty(mSuggestTemplate) || TextUtils.isEmpty(query)) {
            return suggestions;
        }

        if (!isNetworkConnected() && mCheckNetwork) {
            Log.i(LOGTAG, "Not connected to network");
            return suggestions;
        }

        HttpURLConnection urlConnection = null;
        InputStream in = null;
        try {
            String encoded = URLEncoder.encode(query, "UTF-8");
            String suggestUri = mSuggestTemplate.replace("__searchTerms__", encoded);

            URL url = new URL(suggestUri);
            String json = null;
            try {
                urlConnection = (HttpURLConnection) url.openConnection();
                urlConnection.setConnectTimeout(mTimeout);
                urlConnection.setRequestProperty("User-Agent", USER_AGENT);
                in = new BufferedInputStream(urlConnection.getInputStream());
                json = convertStreamToString(in);
            } finally {
                if (urlConnection != null)
                    urlConnection.disconnect();
                if (in != null) {
                    try {
                        in.close();
                    } catch (IOException e) {
                        Log.e(LOGTAG, "error", e);
                    }
                }
            }

            if (json != null) {
                /*
                 * Sample result:
                 * ["foo",["food network","foothill college","foot locker",...]]
                 */
                JSONArray results = new JSONArray(json);
                JSONArray jsonSuggestions = results.getJSONArray(1);

                int added = 0;
                for (int i = 0; (i < jsonSuggestions.length()) && (added < mMaxResults); i++) {
                    String suggestion = jsonSuggestions.getString(i);
                    if (!suggestion.equalsIgnoreCase(query)) {
                        suggestions.add(suggestion);
                        added++;
                    }
                }
            } else {
                Log.e(LOGTAG, "Suggestion query failed");
            }
        } catch (java.net.SocketTimeoutException e) {
            Log.e(LOGTAG, "Timeout error", e);
            if (urlConnection != null)
                urlConnection.disconnect();
            if (in != null) {
                try {
                    in.close();
                } catch (IOException eIO) {
                    Log.e(LOGTAG, "error", eIO);
                }
            }            
        } catch (Exception e) {
            Log.e(LOGTAG, "Error", e);
        }

        mSuggestionsCache.put(query, suggestions);
        //mPrevQuery = query;
        //mPrevResults = suggestions;
        return suggestions;
    }

    private boolean isNetworkConnected() {
        NetworkInfo networkInfo = getActiveNetworkInfo();
        return networkInfo != null && networkInfo.isConnected();
    }

    private NetworkInfo getActiveNetworkInfo() {
        ConnectivityManager connectivity = (ConnectivityManager) mContext
                .getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivity == null)
            return null;
        return connectivity.getActiveNetworkInfo();
    }

    private String convertStreamToString(java.io.InputStream is) {
        try {
            return new java.util.Scanner(is).useDelimiter("\\A").next();
        } catch (java.util.NoSuchElementException e) {
            return "";
        }
    }
}
