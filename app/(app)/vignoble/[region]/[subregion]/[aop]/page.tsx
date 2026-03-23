import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ region: string; subregion: string; aop: string }>;
};

export default async function AppellationPage({ params }: Props) {
  const { region: regionSlug, subregion: subregionSlug, aop: aopSlug } =
    await params;
  redirect(`/vignoble/${regionSlug}/${aopSlug}?subregion=${subregionSlug}`);
}
