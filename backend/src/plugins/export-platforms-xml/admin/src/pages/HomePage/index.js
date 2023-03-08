/*
 *
 * HomePage
 *
 */

import React from 'react';
// import PropTypes from 'prop-types';
import pluginId from '../../pluginId';

import { Box } from '@strapi/design-system/Box';
import { BaseHeaderLayout } from '@strapi/design-system/Layout';
import Platforms from '../../components/Platforms';

const HomePage = () => {

  return (
    <><Box background="neutral100">
      <BaseHeaderLayout
        title="Εξαγωγή XML πλατφορμών"
        subtitle="Ρυθμίστε τις κατηγορίες προϊόντων που θα εξάγονται στα XML των πλατφορμών."
        as="h2"
      />
    </Box>
      <Platforms />
    </>
  );
};

export default HomePage;
