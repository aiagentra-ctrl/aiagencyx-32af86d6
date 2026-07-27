import RealEstateLandingPage from "@/components/demo/realestate/v2/RealEstateLandingPage";
const REPreview = () => (
  <RealEstateLandingPage
    companyName="Harbourline Realty"
    firstName="Marcus"
    brandColor="#0f766e"
    contactEmail="hello@harbourline.com"
    contactPhone="+1 415 555 0142"
    callStatus="idle"
    callSeconds={0}
    onTryCall={() => {}}
    onEndCall={() => {}}
    onTryChat={() => {}}
  />
);
export default REPreview;
