import { useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";
import { api } from "../../src/api";
import { CourseImage } from "../../src/Media";
import { useAuth } from "../../src/auth";
import { useTheme } from "../../src/theme";
import { Action, Card, Copy, Field, Heading, Loading, Meter, Notice, Screen } from "../../src/ui";

export default function Library() {
  const { user } = useAuth(); const { colors } = useTheme(); const [search, setSearch] = useState("");
  const courses = api.dashboard.enrollments.useQuery();
  const visible = useMemo(() => (courses.data ?? []).filter(e => `${e.training?.title ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [courses.data, search]);
  return <Screen scroll={false} style={{ padding: 0 }}><FlatList
    data={visible} keyExtractor={item => String(item.id)} contentContainerStyle={{ padding: 22, gap: 16, paddingBottom: 30 }}
    refreshControl={<RefreshControl refreshing={courses.isRefetching} onRefresh={() => { void courses.refetch(); }} tintColor={colors.gold} />}
    ListHeaderComponent={<View style={{ gap: 16, marginBottom: 4 }}><Text style={{ color: colors.gold, fontSize: 12, fontWeight: "700", letterSpacing: 2 }}>R-AERO · APPRENDRE</Text><Heading>Bonjour {user?.name?.split(" ")[0] ?? ""}.</Heading><Copy muted>Un chapitre de plus vers votre prochain objectif.</Copy><Field label="Rechercher une formation" value={search} onChangeText={setSearch} placeholder="Titre de la formation" autoCorrect={false} />{courses.isError && <><Notice>Vos formations n’ont pas pu être actualisées.</Notice><Action title="Réessayer" onPress={() => { void courses.refetch(); }} /></>}</View>}
    ListEmptyComponent={courses.isLoading ? <Loading /> : courses.isError ? null : <Card><Heading small>{search ? "Aucun résultat" : "Votre bibliothèque vous attend"}</Heading><Copy muted>{search ? "Essayez un autre titre." : "Les formations auxquelles vous êtes inscrit apparaîtront ici. Utilisez le même compte que sur le site ou celui rattaché à votre entreprise."}</Copy></Card>}
    renderItem={({ item }) => <Card>
      {item.training?.thumbnailUrl && <CourseImage url={item.training.thumbnailUrl} />}
      <Heading small>{item.training?.title ?? "Formation indisponible"}</Heading>
      <Copy muted>{item.status === "completed" ? "Formation validée" : item.status === "expired" ? "Accès expiré" : item.status === "failed" ? "Évaluation à reprendre" : `${item.progressPercent ?? 0} % du parcours`}</Copy>
      <Meter value={item.progressPercent ?? 0} />
      <Action title={item.status === "completed" ? "Revoir ma formation" : (item.progressPercent ?? 0) > 0 ? "Reprendre ma formation" : "Commencer ma formation"} onPress={() => router.push(`/course/${item.id}`)} disabled={!item.training || item.status === "expired"} testID={`course-${item.id}`} />
    </Card>}
  /></Screen>;
}
