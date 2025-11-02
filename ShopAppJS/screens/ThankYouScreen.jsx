import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import Animated, { FadeInUp, ZoomIn } from "react-native-reanimated";

const PRIMARY_COLOR = "#1A2980";
const SECONDARY_COLOR = "#26D0CE";
const LIGHT_TEXT_COLOR = "#FFFFFF";

export default function ThankYouScreen({ navigation, route }) {
  const { totalAmount, cartItems } = route.params || {};

  return (
    <LinearGradient colors={[PRIMARY_COLOR, SECONDARY_COLOR]} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />

      {/* ===== HEADER ===== */}
      <View style={styles.headerSection}>
        <Animated.View entering={ZoomIn.duration(500)} style={styles.iconContainer}>
          <Ionicons name="checkmark-circle" size={110} color="#00E676" />
        </Animated.View>

        <Animated.Text entering={FadeInUp.delay(150)} style={styles.title}>
          CẢM ƠN BẠN ĐÃ MUA HÀNG!
        </Animated.Text>

        <Animated.Text entering={FadeInUp.delay(300)} style={styles.subtitle}>
          Đơn hàng của bạn đang được xử lý. Chúng tôi sẽ sớm liên hệ để xác nhận 📦
        </Animated.Text>
      </View>

      {/* ===== TÓM TẮT ĐƠN HÀNG ===== */}
      <Animated.View entering={FadeInUp.delay(450)} style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Tóm tắt đơn hàng</Text>

        {cartItems && cartItems.length > 0 ? (
          <>
            <ScrollView
              style={styles.scrollContainer}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
            >
              {cartItems.map((item, index) => (
                <View key={index} style={styles.productRow}>
                  <Image
                    source={{ uri: item.image_url || item.product?.image_url }}
                    style={styles.productImage}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {item.name || item.product?.name}
                    </Text>
                    <Text style={styles.productDetail}>
                      SL: {item.quantity} | Size: {item.selectedSize || "-"}
                    </Text>
                  </View>
                  <Text style={styles.productPrice}>
                    {(item.price * item.quantity).toLocaleString("vi-VN")} đ
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.summaryRow}>
              <Text style={styles.label}>Tổng thanh toán:</Text>
              <Text style={styles.totalValue}>
                {totalAmount ? totalAmount.toLocaleString("vi-VN") + " đ" : "0 đ"}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>Không có sản phẩm nào trong đơn hàng</Text>
        )}
      </Animated.View>

      {/* ===== NÚT VỀ TRANG CHỦ ===== */}
      <Animated.View entering={FadeInUp.delay(650)} style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() =>
            navigation.dispatch(
              CommonActions.reset({ index: 0, routes: [{ name: "Home" }] })
            )
          }
        >
          <LinearGradient colors={["#00C853", "#64DD17"]} style={styles.buttonGradient}>
            <Ionicons name="home-outline" size={26} color={LIGHT_TEXT_COLOR} />
            <Text style={styles.buttonText}>VỀ TRANG CHỦ</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: "center",
    marginTop: 60,
    marginBottom: 10,
  },
  iconContainer: { marginBottom: 10 },
  title: {
    fontSize: 30, // 🔥 To và nổi bật
    fontWeight: "900",
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#E0E0E0",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  summaryCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    maxHeight: 280, // 🔥 Cao hơn
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: LIGHT_TEXT_COLOR,
    marginBottom: 10,
    textAlign: "center",
  },
  scrollContainer: {
    maxHeight: 190, // đủ cho 3-4 sản phẩm
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.15)",
    paddingBottom: 10,
  },
  productImage: { width: 60, height: 60, borderRadius: 10 },
  productName: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  productDetail: { color: "#ccc", fontSize: 13 },
  productPrice: { color: "#00E676", fontWeight: "600", fontSize: 15 },
  summaryRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
    marginTop: 8,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: { fontSize: 16, color: "#E0E0E0" },
  totalValue: { fontSize: 18, color: "#00E676", fontWeight: "bold" },
  emptyText: { textAlign: "center", color: "#ccc", marginTop: 6 },
  buttonContainer: { width: "85%", marginTop: 15 },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 30,
  },
  buttonText: {
    color: LIGHT_TEXT_COLOR,
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
});
