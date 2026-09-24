import { readableError } from "../../src/errors";
import { useState } from "react";
import { Linking } from "react-native";
import { api, API_ORIGIN } from "../../src/api";
import { sharePdf } from "../../src/files";
import {
  Action,
  Card,
  Copy,
  Heading,
  Loading,
  Notice,
  Screen,
} from "../../src/ui";

export default function Certificates() {
  const certificates = api.dashboard.certificates.useQuery();
  const [sharing, setSharing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const download = async (id: number, url: string, title: string) => {
    setSharing(id);
    setError("");
    try {
      await sharePdf(url, title);
    } catch (e) {
      setError(readableError(e, "Téléchargement impossible."));
    } finally {
      setSharing(null);
    }
  };
  return (
    <Screen>
      <Heading>Mes certificats</Heading>
      <Copy muted>
        Vos acquis et leurs justificatifs, réunis dans votre poche.
      </Copy>
      {!!error && <Notice>{error}</Notice>}
      {certificates.isLoading && <Loading />}
      {certificates.isError && (
        <>
          <Notice>Les certificats n’ont pas pu être actualisés.</Notice>
          <Action
            title="Réessayer"
            onPress={() => {
              void certificates.refetch();
            }}
          />
        </>
      )}
      {certificates.data?.length === 0 && (
        <Card>
          <Heading small>
            Votre prochain acquis commence par une formation.
          </Heading>
          <Copy muted>
            Les certificats délivrés après validation apparaîtront ici.
          </Copy>
        </Card>
      )}
      {certificates.data?.map(certificate => (
        <Card key={certificate.id}>
          <Heading small>
            {certificate.training?.title ?? "Attestation de formation"}
          </Heading>
          <Copy>{certificate.certificateNumber}</Copy>
          <Copy muted>
            Délivré le{" "}
            {new Date(certificate.issuedAt).toLocaleDateString("fr-FR")}
            {certificate.expiresAt
              ? ` · Échéance ${new Date(certificate.expiresAt).toLocaleDateString("fr-FR")}`
              : ""}
          </Copy>
          {certificate.pdfUrl && (
            <Action
              title="Télécharger / partager le PDF"
              busy={sharing === certificate.id}
              disabled={sharing !== null}
              onPress={() => {
                void download(
                  certificate.id,
                  certificate.pdfUrl!,
                  certificate.certificateNumber
                );
              }}
            />
          )}
          <Action
            secondary
            title="Vérifier ce certificat"
            onPress={() => {
              void Linking.openURL(
                `${API_ORIGIN}/verification/${encodeURIComponent(certificate.verificationCode)}`
              );
            }}
          />
        </Card>
      ))}
    </Screen>
  );
}
