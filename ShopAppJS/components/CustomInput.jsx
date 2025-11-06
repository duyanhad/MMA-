// components/CustomInput.jsx
import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 

export default function CustomInput({ 
  value, 
  setValue,        // ✅ khớp với RegisterScreen.jsx
  placeholder, 
  secureTextEntry, 
  iconName,
  keyboardType = 'default',
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const togglePassword = () => setShowPassword(!showPassword);

  return (
    <View style={[styles.container, isFocused && styles.focusedContainer]}>
      {iconName && (
        <Ionicons
          name={iconName}
          size={24}
          color="rgba(255,255,255,0.7)"
          style={styles.icon}
        />
      )}
      <TextInput
        value={value}
        onChangeText={setValue}   // ✅ dùng đúng prop
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.7)"
        secureTextEntry={secureTextEntry && !showPassword}
        style={styles.input}
        autoCapitalize="none"
        keyboardType={keyboardType}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
      {secureTextEntry && (
        <TouchableOpacity onPress={togglePassword} style={styles.eyeIcon}>
          <Ionicons
            name={showPassword ? 'eye-outline' : 'eye-off-outline'}
            size={24}
            color="rgba(255,255,255,0.7)"
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    elevation: 3,
  },
  focusedContainer: {
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  eyeIcon: {
    marginLeft: 10,
    padding: 5,
  },
});
