import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Platform,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { MaxContentWidth } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type BlockWidth = number | `${number}%`;

export function ShimmerBlock({
  width,
  height,
  borderRadius = 8,
  style,
}: {
  width?: BlockWidth;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const colors = useTheme();

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 750, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(shimmer, { toValue: 0, duration: 750, useNativeDriver: Platform.OS !== "web" }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.65] });

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: colors.skeleton, opacity },
        style,
      ]}
    />
  );
}

function ScreenContainer({ children }: { children: ReactNode }) {
  const colors = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>{children}</View>
  );
}

function ListRow({ avatarSize = 44 }: { avatarSize?: number }) {
  return (
    <View style={styles.listRow}>
      <ShimmerBlock width={avatarSize} height={avatarSize} borderRadius={avatarSize / 2} />
      <View style={styles.listRowBody}>
        <ShimmerBlock width="45%" height={13} />
        <ShimmerBlock width="70%" height={11} />
      </View>
      <View style={styles.listRowTrailing}>
        <ShimmerBlock width={28} height={10} />
        <ShimmerBlock width={18} height={18} borderRadius={9} />
      </View>
    </View>
  );
}

function SkeletonPost({ hasImage = false }: { hasImage?: boolean }) {
  const colors = useTheme();
  return (
    <View style={[styles.card, { borderBottomColor: colors.divider }]}>
      <View style={styles.cardHeader}>
        <ShimmerBlock width={36} height={36} borderRadius={18} />
        <View style={styles.cardMeta}>
          <ShimmerBlock width="45%" height={12} />
          <ShimmerBlock width="25%" height={10} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <ShimmerBlock width="95%" height={13} />
        <ShimmerBlock width="70%" height={13} />
      </View>
      {hasImage && <ShimmerBlock width="100%" height={180} borderRadius={12} />}
      <View style={styles.cardActions}>
        <ShimmerBlock width={50} height={28} borderRadius={14} />
        <ShimmerBlock width={50} height={28} borderRadius={14} />
        <ShimmerBlock width={50} height={28} borderRadius={14} />
      </View>
    </View>
  );
}

function SkeletonConfession() {
  const colors = useTheme();
  return (
    <View style={[styles.card, { borderBottomColor: colors.divider }]}>
      <View style={styles.cardHeader}>
        <View style={styles.confessionAvatar}>
          <ShimmerBlock width={48} height={48} borderRadius={24} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <ShimmerBlock width="90%" height={13} />
        <ShimmerBlock width="60%" height={13} />
      </View>
      <View style={styles.cardActions}>
        <ShimmerBlock width={50} height={28} borderRadius={14} />
        <ShimmerBlock width={50} height={28} borderRadius={14} />
      </View>
    </View>
  );
}

function SkeletonEvent() {
  return (
    <View style={styles.eventCard}>
      <ShimmerBlock width="100%" height={120} borderRadius={12} />
      <View style={styles.eventCardBody}>
        <ShimmerBlock width="40%" height={11} />
        <ShimmerBlock width="80%" height={15} />
        <ShimmerBlock width="60%" height={11} />
      </View>
    </View>
  );
}

export function FeedSkeleton() {
  return (
    <View style={styles.feed}>
      <SkeletonEvent />
      <SkeletonPost hasImage />
      <SkeletonPost />
      <SkeletonConfession />
      <SkeletonPost />
    </View>
  );
}

export function DetailSkeleton() {
  const colors = useTheme();
  return (
    <ScreenContainer>
      <View style={styles.detailHeader}>
        <ShimmerBlock width={36} height={36} borderRadius={18} />
        <View style={[styles.detailHeaderMeta, { marginLeft: 12 }]}>
          <ShimmerBlock width="40%" height={14} />
          <ShimmerBlock width="25%" height={10} />
        </View>
      </View>
      <View style={styles.detailBody}>
        <ShimmerBlock width="95%" height={14} />
        <ShimmerBlock width="80%" height={14} />
        <ShimmerBlock width="60%" height={14} />
      </View>
      <ShimmerBlock width="100%" height={200} borderRadius={12} style={styles.detailImage} />
      <View style={[styles.detailActions, { borderTopColor: colors.divider, borderBottomColor: colors.divider }]}>
        <ShimmerBlock width={60} height={28} borderRadius={14} />
        <ShimmerBlock width={60} height={28} borderRadius={14} />
        <ShimmerBlock width={60} height={28} borderRadius={14} />
        <ShimmerBlock width={60} height={28} borderRadius={14} />
      </View>
      <View style={styles.detailSection}>
        <ShimmerBlock width="30%" height={12} />
        <View style={{ gap: 10, marginTop: 10 }}>
          {[1, 2].map((i) => (
            <View key={i} style={styles.commentRow}>
              <ShimmerBlock width={32} height={32} borderRadius={16} />
              <View style={styles.commentBody}>
                <ShimmerBlock width={i === 1 ? "35%" : "30%"} height={11} />
                <ShimmerBlock width={i === 1 ? "55%" : "45%"} height={11} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

export function EventDetailSkeleton() {
  const colors = useTheme();
  return (
    <ScreenContainer>
      <View style={styles.banner}>
        <ShimmerBlock width="100%" height={220} borderRadius={0} />
        <View style={styles.bannerOverlay}>
          <ShimmerBlock width={36} height={36} borderRadius={18} />
          <ShimmerBlock width={36} height={36} borderRadius={18} />
        </View>
      </View>
      <View style={styles.eventDetailBody}>
        <ShimmerBlock width={84} height={26} borderRadius={13} />
        <ShimmerBlock width="85%" height={20} />
        <ShimmerBlock width="55%" height={13} />
        <View style={{ gap: 8, marginTop: 8 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.metaRow}>
              <ShimmerBlock width={16} height={16} borderRadius={8} />
              <ShimmerBlock width={i === 2 ? "35%" : "45%"} height={12} />
            </View>
          ))}
        </View>
        <View style={{ gap: 8, marginTop: 12 }}>
          <ShimmerBlock width="95%" height={12} />
          <ShimmerBlock width="80%" height={12} />
          <ShimmerBlock width="65%" height={12} />
          <ShimmerBlock width="88%" height={12} />
        </View>
      </View>
      <View style={[styles.detailFooter, { borderTopColor: colors.divider, backgroundColor: colors.background }]}>
        <ShimmerBlock width="100%" height={48} borderRadius={24} />
      </View>
    </ScreenContainer>
  );
}

export function ProfileSkeleton({ withHeader = true }: { withHeader?: boolean }) {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const screenWidth = Math.min(width, MaxContentWidth);
  const TILE_SIZE = (screenWidth - 4) / 3;

  return (
    <ScreenContainer>
      {withHeader && (
        <View style={styles.profileHeader}>
          <ShimmerBlock width={36} height={36} borderRadius={18} />
          <ShimmerBlock width={120} height={18} />
          <ShimmerBlock width={36} height={36} borderRadius={18} />
        </View>
      )}
      <View style={styles.profileSection}>
        <ShimmerBlock width={88} height={88} borderRadius={44} />
        <ShimmerBlock width={140} height={20} style={{ marginTop: 10 }} />
        <ShimmerBlock width={100} height={13} />
        <ShimmerBlock width={120} height={12} />
        <View style={styles.statsRow}>
          <ShimmerBlock width={56} height={12} />
          <ShimmerBlock width={4} height={4} borderRadius={2} />
          <ShimmerBlock width={56} height={12} />
          <ShimmerBlock width={4} height={4} borderRadius={2} />
          <ShimmerBlock width={56} height={12} />
        </View>
        <ShimmerBlock width={220} height={36} borderRadius={18} style={{ marginTop: 10 }} />
      </View>
      <View style={[styles.tabBar, { borderTopColor: colors.divider, borderBottomColor: colors.divider }]}>
        {[1, 2, 3].map((i) => (
          <ShimmerBlock key={i} height={46} borderRadius={0} style={{ flex: 1 }} />
        ))}
      </View>
      <View style={styles.profileGrid}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <ShimmerBlock key={i} width={TILE_SIZE} height={TILE_SIZE} borderRadius={0} />
        ))}
      </View>
    </ScreenContainer>
  );
}

export function ListingSkeleton() {
  const colors = useTheme();
  return (
    <ScreenContainer>
      <View style={styles.listingHeader}>
        <ShimmerBlock width={36} height={36} borderRadius={18} />
        <ShimmerBlock width={140} height={16} />
        <ShimmerBlock width={36} height={36} borderRadius={18} />
      </View>
      <ShimmerBlock width="100%" height={280} borderRadius={0} />
      <View style={styles.listingBody}>
        <ShimmerBlock width="75%" height={20} />
        <ShimmerBlock width={92} height={30} borderRadius={15} style={{ marginTop: 10 }} />
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <ShimmerBlock width="92%" height={12} />
        <ShimmerBlock width="80%" height={12} />
        <ShimmerBlock width="70%" height={12} />
        <ShimmerBlock width="86%" height={12} />
        <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        <View style={styles.metaRow}>
          <ShimmerBlock width={20} height={20} borderRadius={10} />
          <View style={{ flex: 1, gap: 5 }}>
            <ShimmerBlock width="30%" height={12} />
            <ShimmerBlock width="45%" height={10} />
          </View>
        </View>
      </View>
      <View style={[styles.listingFooter, { borderTopColor: colors.divider, backgroundColor: colors.background }]}>
        <ShimmerBlock width="100%" height={48} borderRadius={24} />
      </View>
    </ScreenContainer>
  );
}

export function ChatSkeleton() {
  const colors = useTheme();
  return (
    <ScreenContainer>
      <View style={styles.messagesHeader}>
        <View style={{ flex: 1 }}>
          <ShimmerBlock width={140} height={26} />
          <View style={[styles.searchRow, { backgroundColor: colors.inputBg, borderRadius: 21 }]}>
            <ShimmerBlock width={0} height={20} borderRadius={10} style={{ flex: 1, backgroundColor: colors.skeleton }} />
          </View>
        </View>
        <ShimmerBlock width={42} height={42} borderRadius={21} />
      </View>
      <View style={styles.channelList}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <ListRow key={i} avatarSize={44} />
        ))}
      </View>
    </ScreenContainer>
  );
}

export function ChatDetailSkeleton() {
  const colors = useTheme();
  return (
    <ScreenContainer>
      <View style={styles.chatHeader}>
        <ShimmerBlock width={36} height={36} borderRadius={18} />
        <ShimmerBlock width={36} height={36} borderRadius={18} />
        <View style={{ flex: 1, gap: 5 }}>
          <ShimmerBlock width="38%" height={14} />
          <ShimmerBlock width="22%" height={9} />
        </View>
        <ShimmerBlock width={30} height={30} borderRadius={15} />
        <ShimmerBlock width={30} height={30} borderRadius={15} />
        <ShimmerBlock width={30} height={30} borderRadius={15} />
      </View>
      <View style={styles.bubbleArea}>
        <View style={[styles.datePill, { backgroundColor: colors.surface }]}>
          <ShimmerBlock width={100} height={12} />
        </View>
        <View style={[styles.bubbleRow, styles.bubbleRowOther]}>
          <ShimmerBlock width={26} height={26} borderRadius={13} />
          <View style={{ gap: 5 }}>
            <ShimmerBlock width={150} height={38} borderRadius={18} />
            <ShimmerBlock width={34} height={8} borderRadius={4} />
          </View>
        </View>
        <View style={[styles.bubbleRow, styles.bubbleRowOwn]}>
          <View style={{ gap: 5, alignItems: "flex-end" }}>
            <ShimmerBlock width={190} height={38} borderRadius={18} />
            <ShimmerBlock width={40} height={8} borderRadius={4} />
          </View>
        </View>
        <View style={[styles.bubbleRow, styles.bubbleRowOther]}>
          <ShimmerBlock width={26} height={26} borderRadius={13} />
          <View style={{ gap: 5 }}>
            <ShimmerBlock width={120} height={30} borderRadius={16} />
            <ShimmerBlock width={32} height={8} borderRadius={4} />
          </View>
        </View>
        <View style={[styles.bubbleRow, styles.bubbleRowOwn]}>
          <View style={{ gap: 5, alignItems: "flex-end" }}>
            <ShimmerBlock width={160} height={70} borderRadius={14} />
            <ShimmerBlock width={38} height={8} borderRadius={4} />
          </View>
        </View>
        <View style={[styles.bubbleRow, styles.bubbleRowOther]}>
          <ShimmerBlock width={26} height={26} borderRadius={13} />
          <View style={{ gap: 5 }}>
            <ShimmerBlock width={170} height={42} borderRadius={18} />
            <ShimmerBlock width={36} height={8} borderRadius={4} />
          </View>
        </View>
      </View>
      <View style={[styles.composer, { borderTopColor: colors.divider }]}>
        <ShimmerBlock width={32} height={32} borderRadius={16} />
        <ShimmerBlock width={32} height={32} borderRadius={16} />
        <ShimmerBlock height={40} borderRadius={20} style={{ flex: 1, backgroundColor: colors.inputBgAlt }} />
        <ShimmerBlock width={36} height={36} borderRadius={18} />
      </View>
    </ScreenContainer>
  );
}

export function EventsListSkeleton() {
  return (
    <ScreenContainer>
      <View style={styles.screenHeader}>
        <ShimmerBlock width={120} height={26} />
        <ShimmerBlock width={36} height={36} borderRadius={18} />
      </View>
      <View style={styles.chipRow}>
        {[1, 2, 3].map((i) => (
          <ShimmerBlock key={i} width={i === 1 ? 64 : 72 + i * 10} height={36} borderRadius={18} />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <SkeletonEvent />
        <SkeletonEvent />
        <SkeletonEvent />
      </View>
    </ScreenContainer>
  );
}

export function MarketplaceListSkeleton() {
  const { width } = useWindowDimensions();
  const numColumns = width > 600 ? 4 : 2;

  return (
    <ScreenContainer>
      <View style={styles.screenHeader}>
        <ShimmerBlock width={180} height={26} />
        <ShimmerBlock width={36} height={36} borderRadius={18} />
      </View>
      <View style={styles.chipRow}>
        {[56, 88, 96, 72].map((w, i) => (
          <ShimmerBlock key={i} width={w} height={36} borderRadius={18} />
        ))}
      </View>
      <View style={styles.sortRow}>
        {[64, 84, 100].map((w, i) => (
          <ShimmerBlock key={i} width={w} height={32} borderRadius={16} />
        ))}
      </View>
      <View style={styles.screenHeaderSub}>
        <ShimmerBlock width={90} height={12} />
      </View>
      <View style={styles.grid}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <View key={i} style={{ flex: 1 / numColumns }}>
            <MarketplaceCardSkeleton />
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

function MarketplaceCardSkeleton() {
  return (
    <View style={styles.marketplaceCard}>
      <View>
        <ShimmerBlock width="100%" height={150} borderRadius={12} />
        <ShimmerBlock width={54} height={22} borderRadius={6} style={styles.priceBadge} />
      </View>
      <ShimmerBlock width="85%" height={12} />
      <View style={styles.marketplaceMeta}>
        <ShimmerBlock width="40%" height={12} />
        <ShimmerBlock width={32} height={9} />
      </View>
    </View>
  );
}

export function NotificationsListSkeleton() {
  return (
    <ScreenContainer>
      <View style={styles.notificationsList}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.notificationRow}>
            <ShimmerBlock width={36} height={36} borderRadius={18} />
            <View style={styles.listRowBody}>
              <ShimmerBlock width="70%" height={12} />
              <ShimmerBlock width="45%" height={10} />
            </View>
            <ShimmerBlock width={32} height={32} borderRadius={8} />
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

export function SettingsSkeleton() {
  const colors = useTheme();
  return (
    <ScreenContainer>
      <View style={styles.profileHeader}>
        <ShimmerBlock width={36} height={36} borderRadius={18} />
        <ShimmerBlock width={150} height={18} />
        <View style={{ width: 36 }} />
      </View>
      <View style={styles.settingsBody}>
        <ShimmerBlock width="40%" height={14} style={{ marginTop: 4 }} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.settingRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.settingText}>
              <ShimmerBlock width="60%" height={14} />
              <ShimmerBlock width="80%" height={10} />
            </View>
            <ShimmerBlock width={44} height={26} borderRadius={13} />
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

export function SearchResultsSkeleton() {
  return (
    <View style={styles.searchList}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={styles.searchResultRow}>
          <ShimmerBlock width={40} height={40} borderRadius={20} />
          <View style={styles.listRowBody}>
            <ShimmerBlock width={i % 2 === 0 ? "45%" : "38%"} height={13} />
            <ShimmerBlock width="65%" height={11} />
          </View>
          <ShimmerBlock width={16} height={16} borderRadius={8} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
  },
  feed: {
    flex: 1,
    width: "100%",
  },
  card: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardMeta: {
    flex: 1,
    gap: 5,
  },
  cardBody: {
    marginTop: 10,
    gap: 7,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  confessionAvatar: {
    alignSelf: "center",
  },
  eventCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  eventCardBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailHeaderMeta: {
    flex: 1,
    gap: 6,
  },
  detailBody: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  detailImage: {
    alignSelf: "center",
  },
  detailActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  detailSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  commentRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  commentBody: {
    flex: 1,
    gap: 5,
  },
  banner: {
    position: "relative",
  },
  bannerOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eventDetailBody: {
    padding: 16,
    gap: 12,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  detailFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 0.5,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  profileSection: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 6,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 8,
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    padding: 2,
  },
  listingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  listingBody: {
    padding: 16,
    gap: 10,
  },
  divider: {
    height: 0.5,
    width: "100%",
    marginVertical: 6,
  },
  listingFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: 0.5,
  },
  messagesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  channelList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  listRowBody: {
    flex: 1,
    gap: 5,
  },
  listRowTrailing: {
    alignItems: "flex-end",
    gap: 6,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  datePill: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    maxWidth: "78%",
  },
  bubbleRowOwn: {
    alignSelf: "flex-end",
  },
  bubbleRowOther: {
    alignSelf: "flex-start",
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 0.5,
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  screenHeaderSub: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  marketplaceCard: {
    gap: 8,
  },
  marketplaceMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  priceBadge: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  notificationsList: {
    padding: 16,
    gap: 16,
  },
  notificationRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  settingsBody: {
    paddingHorizontal: 16,
    gap: 16,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  settingText: {
    gap: 6,
    flex: 1,
  },
  searchList: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
});
