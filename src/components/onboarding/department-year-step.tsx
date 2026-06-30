import { StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { spacing, fontSize, fontWeight } from "@/theme";

const DEPARTMENTS = [
  "Computer Science",
  "Engineering",
  "Mathematics",
  "Physics",
  "Biology",
  "Chemistry",
  "Business",
  "Arts",
  "Other",
];

const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];

type Props = {
  department: string;
  year: string;
  onDepartmentChange: (d: string) => void;
  onYearChange: (y: string) => void;
};

export function DepartmentYearStep({
  department,
  year,
  onDepartmentChange,
  onYearChange,
}: Props) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>About you</ThemedText>
      <ThemedText themeColor="textSecondary">
        What do you study?
      </ThemedText>

      <ThemedView style={styles.section}>
        <ThemedText style={styles.label}>Department</ThemedText>
        <ThemedView style={styles.options}>
          {DEPARTMENTS.map((d) => (
            <Button
              key={d}
              title={d}
              variant={department === d ? "primary" : "secondary"}
              size="sm"
              onPress={() => onDepartmentChange(d)}
            />
          ))}
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText style={styles.label}>Year</ThemedText>
        <ThemedView style={styles.options}>
          {YEARS.map((y) => (
            <Button
              key={y}
              title={y}
              variant={year === y ? "primary" : "secondary"}
              size="sm"
              onPress={() => onYearChange(y)}
            />
          ))}
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
  },
  section: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  options: {
    gap: spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
