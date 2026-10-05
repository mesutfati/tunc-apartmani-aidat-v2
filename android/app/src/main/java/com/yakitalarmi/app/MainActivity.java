package com.yakitalarmi.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VisionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
